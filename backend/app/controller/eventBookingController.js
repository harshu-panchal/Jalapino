import mongoose from 'mongoose';
import Setting from '../models/setting.js';
import EventBooking from '../models/event/EventBooking.js';
import EventReservation from '../models/event/EventReservation.js';
import EventPayout from '../models/event/EventPayout.js';
import SellerCalendar from '../models/event/SellerCalendar.js';
import Seller from '../models/seller.js';
import Product from '../models/product.js';
import EventCategory from '../models/event/EventCategory.js';
import handleResponse from '../utils/helper.js';
import { emitSellerNotification, emitCustomerNotification } from '../modules/notifications/notification.service.js';
import { getBookingStart, isBookingWithinAdvanceNotice, parseTimeToMinutes, getEventEndIST, getEventStartIST as getSlotStartIST, formatIST, isEventBookingCalendarLocked } from '../utils/advanceBooking.js';
import { creditWallet, debitWallet, getOrCreateWallet, updateCashInHand } from '../services/finance/walletService.js';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { OWNER_TYPE, LEDGER_TRANSACTION_TYPE } from '../constants/finance.js';

// Event start in India time (IST, +05:30), independent of the server timezone.
const getEventStartIST = (eventDate, eventTime) => {
    if (!eventDate) return null;
    const dateStr = new Date(eventDate).toISOString().slice(0, 10);
    const minutes = parseTimeToMinutes(eventTime);
    const hh = String(Math.floor((minutes ?? 0) / 60)).padStart(2, '0');
    const mm = String((minutes ?? 0) % 60).padStart(2, '0');
    const start = new Date(`${dateStr}T${hh}:${mm}:00+05:30`);
    return Number.isNaN(start.getTime()) ? null : start;
};

// RedBus-style refund: for each product, use the slab with the largest
// `hoursBefore` that is still <= hours left before the event. Below the smallest
// slab (or no slabs) => 0%. Refund is a % of what the customer actually paid.
export const computeEventCancellationRefund = (booking, now = Date.now()) => {
    // Count hours from the event date at first payment (if the date was moved later,
    // the refund still uses the original date).
    const start = getEventStartIST(
        booking.refundBaseEventDate || booking.eventDate,
        booking.refundBaseEventDate ? booking.refundBaseEventTime : booking.eventTime
    );
    const hoursLeft = start ? (start.getTime() - now) / (1000 * 60 * 60) : 0;
    const total = Number(booking.totalAmount) || 0;
    // Verified money (Razorpay) takes priority. Older bookings fall back to the
    // payment status; their refund is put on review instead of auto-credited.
    const verifiedPaid = Math.min(total, Number(booking.amountPaid) || 0);
    const legacyPaid = booking.paymentStatus === 'PAID'
        ? total
        : booking.paymentStatus === 'ADVANCE_PAID'
            ? Math.min(total, Number(booking.advancePaymentAmount) || 0)
            : 0;
    const isVerified = verifiedPaid > 0;
    const paid = isVerified ? verifiedPaid : legacyPaid;
    const lines = (booking.selectedProducts || []).map(line => {
        const addOns = (line.selectedAddOns || []).reduce((s, a) => s + (Number(a.price) || 0), 0);
        const lineTotal = (Number(line.price || line.unitPrice) || 0) * (Number(line.quantity) || 1) + addOns;
        const rules = (line.cancellationRules || [])
            .map(r => ({ hoursBefore: Number(r.hoursBefore), refundPercent: Number(r.refundPercent) }))
            .filter(r => Number.isFinite(r.hoursBefore) && Number.isFinite(r.refundPercent))
            .sort((a, b) => b.hoursBefore - a.hoursBefore);
        const slab = rules.find(r => hoursLeft >= r.hoursBefore);
        const refundPercent = slab ? Math.min(100, Math.max(0, slab.refundPercent)) : 0;
        const linePaid = total > 0 ? paid * (lineTotal / total) : 0;
        return {
            productName: line.productName || 'Product',
            refundPercent,
            refundAmount: Math.round(linePaid * refundPercent) / 100,
            hasRules: rules.length > 0,
        };
    });
    const refundAmount = Math.round(lines.reduce((s, l) => s + l.refundAmount, 0) * 100) / 100;
    return { hoursBeforeEvent: Math.round(hoursLeft * 100) / 100, paidAmount: paid, refundAmount, lines, isVerified };
};

// Shop / product / date capacity for one seller on one date. Only PAID bookings
// (see isEventBookingCalendarLocked) count. Returns { error, selectedShop }.
export const EVENT_PAYMENT_HOLD_MS = 10 * 60 * 1000;
const hasActivePaymentHold = (b) => Boolean(b?.paymentHoldUntil) && new Date(b.paymentHoldUntil).getTime() > Date.now();

export const findEventCapacityConflict = async ({ seller, sellerId, eventDateStr, requestedTime, selectedShop, selectedProductLines = [], requestedGuests = 1, excludeBookingId = null, includeHolds = false }) => {
        // Count existing accepted bookings for this seller on this date
        const startOfDay = new Date(eventDateStr);
        const endOfDay = new Date(startOfDay);
        endOfDay.setDate(endOfDay.getDate() + 1);

        // Only PAID bookings (advance/full online, or COD confirmed) hold the
        // date/slot. Unpaid requests do not lock the calendar.
        const bookingsOnDate = (await EventBooking.find({
            "services.seller": sellerId,
            eventDate: { $gte: startOfDay, $lt: endOfDay },
            overallStatus: { $nin: ['CANCELLED', 'REJECTED'] }
        })).filter(b => (isEventBookingCalendarLocked(b) || (includeHolds && hasActivePaymentHold(b))) && String(b._id) !== String(excludeBookingId || ''));

        const bookingsForSelectedTime = requestedTime
            ? bookingsOnDate.filter(booking => (
                String(booking.eventTime || '').trim() === requestedTime
                || (Array.isArray(booking.multipleEvents) && booking.multipleEvents.some(event => (
                    String(event.date || eventDateStr).trim() === eventDateStr
                    && String(event.time || '').trim() === requestedTime
                )))
            ))
            : bookingsOnDate;

        // Shop capacity is independent from product/variant capacity. A booking
        // consumes one slot of the selected shop, regardless of which variant
        // was selected. Only paid bookings reserve capacity; unpaid, cancelled
        // and rejected bookings do not.
        // If the client did not send selectedShop, derive it on the server
        // from the selected shop-capacity variant codes so the check is
        // never skipped.
        if (seller.capacityEnabled && !(selectedShop?.uniqueCode || selectedShop?.shopNo)) {
            selectedShop = (seller.shopsAtLocation || []).find(s =>
                String(s.capacityType || 'SHOP CAPECITY').trim().toUpperCase().includes('SHOP') &&
                selectedProductLines.some(line =>
                    (line.uniqueCode && String(s.uniqueCode || '').trim().toUpperCase() === line.uniqueCode.toUpperCase()) ||
                    (!line.uniqueCode && line.shopNo && String(s.shopNo || '').trim() === line.shopNo)
                )
            ) || null;
        }
        const requestedShopCode = String(selectedShop?.uniqueCode || '').trim().toUpperCase();
        const requestedShopNo = String(selectedShop?.shopNo || '').trim();
        const hasProductCapacityLines = seller.capacityEnabled && selectedProductLines.some(line => line.uniqueCode);
        if (seller.capacityEnabled && (requestedShopCode || requestedShopNo)) {
            const shop = (seller.shopsAtLocation || []).find(s =>
                String(s.uniqueCode || '').trim().toUpperCase() === requestedShopCode ||
                (requestedShopNo && String(s.shopNo || '') === requestedShopNo)
            );
            if (!shop) return { error: 'Selected shop is not configured for this seller', selectedShop };
            const isBookingForShop = (b) =>
                String(b.selectedShop?.uniqueCode || '').trim().toUpperCase() === requestedShopCode ||
                (requestedShopNo && String(b.selectedShop?.shopNo || '') === requestedShopNo) ||
                (Array.isArray(b.selectedProducts) && b.selectedProducts.some(line =>
                    String(line.uniqueCode || line.selectedVariant?.uniqueCode || '').trim().toUpperCase() === requestedShopCode ||
                    (requestedShopNo && String(line.shopNo || line.selectedVariant?.shopNo || '') === requestedShopNo)
                ));
            const shopType = String(shop.bookingType || selectedShop?.bookingType || 'MULTIPLE').toUpperCase();
            // SINGLE shop capacity locks the whole selected date after the
            // first booking, even when another time slot is requested.
            // MULTIPLE shop capacity allows one booking per time slot; a
            // different slot on the same date remains available.
            const shopBookings = (shopType === 'SINGLE' ? bookingsOnDate : bookingsForSelectedTime)
                .filter(isBookingForShop);
            if (shopBookings.length > 0) {
                return { error: 'This variant is already booked for the selected date and time slot.', selectedShop };
            }
        }

        // Product capacity is date-only and independent from shop capacity.
        // Usage is counted per UNIQUE CODE: every variant/product that carries
        // the same product-capacity code shares that code's date capacity.
        for (const line of (seller.capacityEnabled ? selectedProductLines : [])) {
            const code = String(line.uniqueCode || '').trim().toUpperCase();
            if (!code) continue;
            const product = await Product.findOne({ _id: line.productId, sellerId }).select('variants').lean();
            const variant = (product?.variants || []).find(v => String(v.uniqueCode || '').trim().toUpperCase() === code);
            if (!variant) return { error: `Product code ${code} is not configured for this product`, selectedShop };
            const capacityType = String(variant.capacityType || '').trim().toUpperCase();
            const lineCodeOf = (l) => String(l?.uniqueCode || l?.selectedVariant?.uniqueCode || '').trim().toUpperCase();
            // Shop-capacity variants: date/slot locking is validated only by the
            // shop block above. Here only the shop row's quantity Min/Max is
            // enforced; product date capacity is never applied to them.
            if (capacityType.includes('SHOP')) {
                // Use the seller's CURRENT shop row (same source as the shop lock),
                // falling back to the product variant copy.
                const shopRow = (seller.shopsAtLocation || []).find(s => String(s.uniqueCode || '').trim().toUpperCase() === code);
                const shopMin = Number(shopRow?.minimum || variant.minimum || 0);
                const shopMax = Number(shopRow?.maximum || shopRow?.totalCapacity || variant.maximum || variant.totalCapacity || 0);
                const shopQty = selectedProductLines
                    .filter(selected => lineCodeOf(selected) === code)
                    .reduce((sum, selected) => sum + (Number(selected.quantity) || 0), 0);
                if (shopMin > 0 && line.quantity < shopMin) {
                    return { error: `Product code ${code} requires a minimum quantity of ${shopMin}.`, selectedShop };
                }
                if (shopMax > 0 && shopQty > shopMax) {
                    return { error: `Product code ${code} allows a maximum quantity of ${shopMax}.`, selectedShop };
                }
                continue;
            }
            const productBookings = bookingsOnDate.flatMap(b => (b.selectedProducts || [])
                .filter(existing => lineCodeOf(existing) === code));
            const type = String(variant.bookingType || 'MULTIPLE').toUpperCase();
            const minimum = Number(variant.minimum || 0);
            if (minimum > 0 && line.quantity < minimum) {
                return { error: `Product code ${code} requires a minimum quantity of ${minimum}.`, selectedShop };
            }
            if (type === 'SINGLE' && productBookings.length > 0) {
                return { error: 'This variant is already booked on this date.', selectedShop };
            }
            const max = Number(variant.maximum || variant.totalCapacity || 0);
            const requestedProductQuantity = selectedProductLines
                .filter(selected => lineCodeOf(selected) === code)
                .reduce((sum, selected) => sum + (Number(selected.quantity) || 0), 0);
            const used = productBookings.reduce((sum, existing) => sum + (Number(existing.quantity) || 0), 0);
            if (type !== 'SINGLE' && max > 0 && used + requestedProductQuantity > max) {
                return { error: 'This product is already fully booked on this date.', selectedShop };
            }
        }

        const existingBookingsCount = bookingsOnDate.length;
        const numberOfShops = seller.numberOfShops || 1;
        
        if (!hasProductCapacityLines && seller.bookingType === 'one_time') {
            if (existingBookingsCount >= numberOfShops) {
                return { error: "The selected provider has reached their maximum booking capacity for this date (One-time bookings full).", selectedShop };
            }
        } else if (!hasProductCapacityLines) {
            // Multiple time -> check total capacity
            let consumedCapacity = 0;
            bookingsOnDate.forEach(b => {
                // Try to get guest count from booking data
                let gCount = 1;
                if (b.eventData?.guestCount) {
                    gCount = parseInt(b.eventData.guestCount, 10);
                } else if (b.guestCount) {
                    gCount = parseInt(b.guestCount, 10);
                }
                if (isNaN(gCount)) gCount = 1;
                consumedCapacity += gCount;
            });
            
            const maxAllowedCapacity = (seller.totalCapacity || 100) * numberOfShops;
            if ((consumedCapacity + requestedGuests) > maxAllowedCapacity) {
                return { error: `The selected provider does not have enough capacity on this date. Available capacity: ${maxAllowedCapacity - consumedCapacity}`, selectedShop };
            }
        }
    return { error: null, selectedShop };
};

// Before money is taken for an unpaid booking: is its date/slot still free?
// (another customer may have paid first, or the seller blocked the date).
export const checkEventBookingStillAvailable = async (booking, { includeHolds = true } = {}) => {
    if (!booking || isEventBookingCalendarLocked(booking)) return null;
    const sellerId = (booking.services || []).map(s => s.seller).find(Boolean);
    if (!sellerId || !booking.eventDate) return null;
    const eventDateStr = new Date(booking.eventDate).toISOString().split('T')[0];
    const calendar = await SellerCalendar.findOne({ seller: sellerId });
    if (calendar && (calendar.blockedDates || []).some(bd => bd.date === eventDateStr)) {
        return 'The provider is no longer available on this date. Please choose another date.';
    }
    const seller = await Seller.findById(sellerId);
    if (!seller) return null;
    const plain = (v) => (v && typeof v.toObject === 'function' ? v.toObject() : v);
    const capacityArgs = {
        seller,
        sellerId,
        eventDateStr,
        requestedTime: String(booking.eventTime || '').trim(),
        selectedShop: plain(booking.selectedShop) || null,
        selectedProductLines: (booking.selectedProducts || []).map(line => {
            const l = plain(line) || {};
            return { ...l, uniqueCode: String(l.uniqueCode || l.selectedVariant?.uniqueCode || '').trim(), shopNo: String(l.shopNo || l.selectedVariant?.shopNo || '').trim(), quantity: Number(l.quantity) || 1 };
        }),
        requestedGuests: Number(booking.guestCount) || 1,
        excludeBookingId: booking._id,
    };
    const paidConflict = await findEventCapacityConflict(capacityArgs);
    if (paidConflict.error) return 'This date/slot has just been booked by another customer (payment done). Please choose another date or time.';
    if (includeHolds) {
        const heldConflict = await findEventCapacityConflict({ ...capacityArgs, includeHolds: true });
        if (heldConflict.error) return 'Another customer is completing payment for this slot right now. Please try again in a few minutes.';
    }
    return null;
};

// Create a new event booking
// After a booking gets paid (online advance/full or COD confirmed): other UNPAID
// bookings of the same seller on that date that no longer fit (same capacity rules)
// are closed, and the customer + seller are told. Paid bookings are never touched.
export const SLOT_TAKEN_NOTE = 'Slot booked by another customer (payment done).';
export const closeConflictingUnpaidBookings = async (paidBooking) => {
    try {
        const sellerId = (paidBooking?.services || []).map(s => s.seller).find(Boolean);
        if (!sellerId || !paidBooking.eventDate) return [];
        const dateStr = new Date(paidBooking.eventDate).toISOString().split('T')[0];
        const startOfDay = new Date(dateStr);
        const endOfDay = new Date(startOfDay);
        endOfDay.setDate(endOfDay.getDate() + 1);
        const others = await EventBooking.find({
            "services.seller": sellerId,
            eventDate: { $gte: startOfDay, $lt: endOfDay },
            overallStatus: { $nin: ['CANCELLED', 'REJECTED', 'COMPLETED'] },
        });
        const closed = [];
        for (const other of others) {
            if (String(other._id) === String(paidBooking._id) || isEventBookingCalendarLocked(other)) continue;
            if (hasActivePaymentHold(other)) continue;
            const unavailable = await checkEventBookingStillAvailable(other, { includeHolds: false });
            if (!unavailable) continue;
            other.overallStatus = 'CANCELLED';
            (other.services || []).forEach(service => {
                if (String(service.seller) === String(sellerId) && service.status !== 'COMPLETED') {
                    service.status = 'REJECTED';
                    service.sellerNotes = SLOT_TAKEN_NOTE;
                }
            });
            await other.save();
            closed.push(other);
            emitCustomerNotification('EVENT_BOOKING_REJECTED', {
                userId: other.customer,
                bookingId: other._id,
                message: `The slot for your booking ${other.bookingId} was booked by another customer. Please choose another date or time.`,
            });
        }
        if (closed.length > 0) {
            emitSellerNotification('EVENT_BOOKING_SLOT_TAKEN', {
                userId: sellerId,
                bookingId: paidBooking._id,
                message: `Booking ${paidBooking.bookingId} is paid for this slot, so unpaid booking${closed.length > 1 ? 's' : ''} ${closed.map(b => b.bookingId).join(', ')} ${closed.length > 1 ? 'were' : 'was'} closed automatically.`,
            });
        }
        return closed;
    } catch (error) {
        console.error('Auto-close of conflicting unpaid bookings failed:', error?.message || error);
        return [];
    }
};

export const createEventBooking = async (req, res) => {
    try {
        let { eventData, preferences, selectedCategories, paymentMethod, paymentDetails, amount, sellerId, selectedProducts = [], selectedShop = null } = req.body;
        const customerId = req.user.id || req.user._id;

        if (!sellerId) {
            return handleResponse(res, 400, "Seller is required for booking");
        }

        const baseAmount = Number(amount || 0);
        if (!Number.isFinite(baseAmount) || baseAmount < 0) {
            return handleResponse(res, 400, "Booking amount is invalid");
        }

        let productSubtotal = 0;
        let selectedProductLines = [];
        if (Array.isArray(selectedProducts) && selectedProducts.length > 0) {
            selectedProductLines = selectedProducts.map(line => {
                const addOns = Array.isArray(line.selectedAddOns) ? line.selectedAddOns : [];
                const addOnTotal = addOns.reduce((s, a) => s + (Number(a.price) || 0), 0);
                const unitPrice = Number(line.price || 0);
                const quantity = Number(line.quantity || 1);
                return {
                    productId: line.productId || line._id,
                    quantity: quantity,
                    price: unitPrice,
                    unitPrice: unitPrice,
                    selectedColors: Array.isArray(line.selectedColors) ? line.selectedColors : [],
                    selectedVariant: line.selectedVariant || null,
                    uniqueCode: String(line.uniqueCode || line.selectedVariant?.uniqueCode || '').trim(),
                    shopNo: String(line.shopNo || line.selectedVariant?.shopNo || '').trim(),
                    selectedAddOns: addOns,
                    lineTotal: (unitPrice * quantity) + addOnTotal
                };
            });

            if (selectedProductLines.some(line => !line.productId || !Number.isInteger(line.quantity) || line.quantity < 1)) {
                return handleResponse(res, 400, "Selected product quantities are invalid");
            }

            const productDocs = await Product.find({
                _id: { $in: selectedProductLines.map(line => line.productId) },
                sellerId,
            }).select('_id name price salePrice colors variants hasAddOn fixedAddOns clickBoxAddOns cancellationPolicy cancellationRules').lean();

            const productsById = new Map(productDocs.map(product => [String(product._id), product]));
            if (selectedProductLines.some(line => !productsById.has(String(line.productId)))) {
                return handleResponse(res, 400, "One or more selected products are unavailable for this seller");
            }
            selectedProductLines = selectedProductLines.map(line => {
                const doc = productsById.get(String(line.productId));
                const finalPrice = line.price > 0 ? line.price : (doc.salePrice || doc.price || 0);
                const addOnTotal = (line.selectedAddOns || []).reduce((s, a) => s + (Number(a.price) || 0), 0);
                // Strong lock: a line sent without a variant code falls back to the
                // product's first variant (same default the customer UI uses), so
                // capacity checks are never skipped.
                const fallbackVariant = !line.uniqueCode ? (doc.variants || [])[0] : null;
                return {
                    ...line,
                    // Always taken from the DB product (never from the client).
                    cancellationPolicy: String(doc.cancellationPolicy || '').trim(),
                    cancellationRules: Array.isArray(doc.cancellationRules)
                        ? doc.cancellationRules.map(r => ({ hoursBefore: Number(r.hoursBefore) || 0, refundPercent: Number(r.refundPercent) || 0 }))
                        : [],
                    ...(fallbackVariant?.uniqueCode ? {
                        uniqueCode: String(fallbackVariant.uniqueCode).trim(),
                        shopNo: line.shopNo || String(fallbackVariant.shopNo || '').trim(),
                    } : {}),
                    productName: doc.name,
                    price: finalPrice,
                    unitPrice: finalPrice,
                    lineTotal: (finalPrice * line.quantity) + addOnTotal
                };
            });

            const hasInvalidProductColors = selectedProductLines.some(line => {
                const allowedColors = productsById.get(String(line.productId)).colors || [];
                return line.selectedColors.some(color => !allowedColors.includes(color));
            });
            if (hasInvalidProductColors) {
                return handleResponse(res, 400, "One or more selected product colors are unavailable");
            }

            productSubtotal = selectedProductLines.reduce((sum, line) => {
                return sum + line.lineTotal;
            }, 0);
        }

        // Fetch GASP Global Settings
        const globalSettings = await Setting.findOne({});
        
        // --- GASP BOOKING ENGINE: Booking Window Validation ---
        let primaryDate = eventData.date;
        if (!primaryDate && eventData.multipleEvents && eventData.multipleEvents.length > 0) {
            primaryDate = eventData.multipleEvents[0].date;
        }
        const eventDateObj = new Date(primaryDate || Date.now());
        const eventDateStr = eventDateObj.toISOString().split('T')[0];
        const requestedTime = String(eventData.time || eventData.eventTime || eventData.multipleEvents?.[0]?.time || '').trim();
        const daysDifference = Math.ceil((eventDateObj.getTime() - Date.now()) / (1000 * 3600 * 24));
        const maxAdvanceDays = globalSettings?.bookingControl?.bookingWindowDays ?? 365;
        
        if (daysDifference > maxAdvanceDays) {
            return handleResponse(res, 400, `Booking rejected by GASP: You cannot book an event more than ${maxAdvanceDays} days in advance.`);
        }

        const sellerForAdvanceCheck = await Seller.findById(sellerId).select('advanceBookingBufferEnabled advanceBookingBuffer advanceBookingBufferUnit advanceBookingBufferTime shopTimingsEnabled shopOpeningTime shopClosingTime').lean();
        if (sellerForAdvanceCheck && !isBookingWithinAdvanceNotice(sellerForAdvanceCheck, eventDateStr, requestedTime)) {
            const bookingStart = getBookingStart(eventDateStr, requestedTime);
            return handleResponse(res, 400, `Booking requires advance notice until ${bookingStart?.toLocaleString() || 'the selected time'}.`);
        }

        // --- SELLER CALENDAR VALIDATION & OFFLINE PROTECTION ---
        // 1. Check if seller has blocked this date
        const calendar = await SellerCalendar.findOne({ seller: sellerId });
        if (calendar) {
            const isBlocked = calendar.blockedDates.some(bd => bd.date === eventDateStr);
            if (isBlocked) {
                return handleResponse(res, 400, "The selected provider is unavailable on this date. Please choose another date or an alternative provider.");
            }
        }

        // 2. Check max events per day for the seller
        const seller = await Seller.findById(sellerId);
        if (seller) {
            // Check guest capacity
            const requestedGuests = parseInt(eventData.guestCount, 10) || 1;
            if (seller.minGuestCapacity && requestedGuests < seller.minGuestCapacity) {
                return handleResponse(res, 400, `The requested guest count is below the provider's minimum capacity of ${seller.minGuestCapacity}.`);
            }
            if (seller.maxGuestCapacity && requestedGuests > seller.maxGuestCapacity) {
                return handleResponse(res, 400, `The requested guest count exceeds the provider's maximum capacity of ${seller.maxGuestCapacity}.`);
            }

            // Check if seller shop is closed / holiday on this date
            if (seller.shopHolidaysEnabled && Array.isArray(seller.shopClosedDates) && seller.shopClosedDates.includes(eventDateStr)) {
                return handleResponse(res, 400, `The provider's shop is closed on ${eventDateStr}. Please choose an alternative date.`);
            }

            // Shop timing ON: booking time must be within opening and closing time
            if (seller.shopTimingsEnabled) {
                const toMinutes = (value) => {
                    const match = String(value || '').trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
                    if (!match) return null;
                    let hours = Number(match[1]);
                    const minutes = Number(match[2] || 0);
                    const period = match[3]?.toUpperCase();
                    if (period === 'PM' && hours !== 12) hours += 12;
                    if (period === 'AM' && hours === 12) hours = 0;
                    return hours * 60 + minutes;
                };
                const openMin = toMinutes(seller.shopOpeningTime);
                const closeMin = toMinutes(seller.shopClosingTime);
                if (openMin !== null && closeMin !== null && openMin < closeMin) {
                    const times = [eventData.time || eventData.eventTime, ...(Array.isArray(eventData.multipleEvents) ? eventData.multipleEvents.map(e => e?.time) : [])]
                        .map(t => String(t || '').trim())
                        .filter(Boolean);
                    const outside = times.some((t) => {
                        const [startPart, endPart] = t.split('-');
                        const start = toMinutes(startPart);
                        const end = endPart ? toMinutes(endPart) : null;
                        if (start === null) return false;
                        return start < openMin || start > closeMin || (end !== null && end > closeMin);
                    });
                    if (outside) {
                        return handleResponse(res, 400, `Please select a time within shop timing (${seller.shopOpeningTime} - ${seller.shopClosingTime}).`);
                    }
                }
            }

            const capacityResult = await findEventCapacityConflict({ seller, sellerId, eventDateStr, requestedTime, selectedShop, selectedProductLines, requestedGuests });
            if (capacityResult.error) return handleResponse(res, 400, capacityResult.error);
            selectedShop = capacityResult.selectedShop;
        }
        // -------------------------------------------------------

        // Create booking ID
        const bookingId = `EVT-${Date.now()}`;

        // Map categories to services format
        const resolvedCategories = await Promise.all((selectedCategories || []).map(async (cat) => {
            const rawCatId = typeof cat === 'object' ? (cat?._id || cat?.id || cat?.name) : cat;
            let resolvedId = null;

            if (rawCatId && mongoose.Types.ObjectId.isValid(rawCatId)) {
                resolvedId = rawCatId;
            } else if (rawCatId && typeof rawCatId === 'string') {
                // If category name (e.g., "WaterPark") was sent instead of ObjectId, find its ObjectId
                const matchedCategory = await EventCategory.findOne({ name: new RegExp(`^${rawCatId.trim()}$`, 'i') }).select('_id');
                if (matchedCategory) {
                    resolvedId = matchedCategory._id;
                }
            }

            return {
                rawKey: rawCatId,
                categoryId: resolvedId
            };
        }));

        const services = resolvedCategories.map(({ rawKey, categoryId }) => {
            const catPreferences = preferences ? (preferences[categoryId] || preferences[rawKey]) : {};
            const bookingPreferences = { ...(catPreferences || {}) };
            const selectedProductColors = selectedProductLines
                .filter(line => line.selectedColors.length > 0)
                .map(line => ({
                    productId: line.productId,
                    productName: line.productName,
                    colors: line.selectedColors,
                }));
            if (selectedProductColors.length > 0) {
                bookingPreferences.selectedProductColors = selectedProductColors;
            }

            return {
                seller: sellerId,
                category: categoryId || null,
                quotePermissions: {
                    sellerQuotation: Boolean(seller?.customizationEngineEnabled && seller?.quoteSellerQuotation),
                    revision: Boolean(seller?.customizationEngineEnabled && seller?.quoteQuoteRevision),
                    customerApproval: Boolean(seller?.customizationEngineEnabled && seller?.quoteCustomerApproval),
                },
                preferences: Object.keys(bookingPreferences).map(key => ({
                    fieldName: key,
                    value: bookingPreferences[key]
                }))
            };
        });

        // Create the booking entry
        const calculatedTotalAmount = baseAmount + productSubtotal;
        const advancePercentage = Number(seller?.advancePaymentPercentage || 0);
        const calculatedAdvance = advancePercentage > 0 ? Math.round((calculatedTotalAmount * advancePercentage) / 100) : 0;

        const newBooking = new EventBooking({
            bookingId: bookingId,
            customer: customerId,
            eventType: eventData.eventType || 'Custom',
            eventDate: new Date(primaryDate || Date.now()),
            eventTime: eventData.time || '10:00 AM',
            remarks: eventData.remarks || (eventData.multipleEvents && eventData.multipleEvents[0]?.remarks) || '',
            multipleEvents: eventData.multipleEvents || [],
            eventInfo: eventData.eventInfo || {},
            selectedProducts: selectedProductLines,
            selectedShop: selectedShop ? {
                uniqueCode: String(selectedShop.uniqueCode || '').trim(),
                shopNo: String(selectedShop.shopNo || '').trim(),
                bookingType: String(selectedShop.bookingType || '').trim(),
                capacityType: String(selectedShop.capacityType || '').trim(),
                minimum: Number(selectedShop.minimum || 0),
                maximum: Number(selectedShop.maximum || 0),
                totalCapacity: Number(selectedShop.totalCapacity || 0)
            } : undefined,
            advancePaymentAmount: calculatedAdvance,
            advancePaymentPercentage: advancePercentage,
            location: {
                address: eventData.location || (eventData.eventInfo && eventData.eventInfo.functionLocation) || 'Pending Address'
            },
            guestCount: parseInt(eventData.guestCount, 10) || 1,
            budget: parseInt(eventData.budget, 10) || 0,
            services: services,
            paymentStatus: 'PENDING',
            paymentMode: paymentMethod || 'ONLINE', // Will be finalized later
            totalAmount: calculatedTotalAmount,
            overallStatus: 'PENDING' // Waiting for seller approval
        });

        const savedBooking = await newBooking.save();

        // Notify all sellers involved
        services.forEach(service => {
            if (service.seller) {
                emitSellerNotification('NEW_EVENT_BOOKING_REQUEST', {
                    userId: service.seller,
                    bookingId: savedBooking._id,
                    message: 'New booking received'
                });
            }
        });

        // Send response
        return handleResponse(res, 201, 'Event booked successfully', savedBooking);
    } catch (error) {
        console.error('Error creating event booking:', error);
        return handleResponse(res, 500, `Failed to create event booking: ${error.message}`);
    }
};

// Get customer's event bookings
export const getMyEventBookings = async (req, res) => {
    try {
        const customerId = req.user.id || req.user._id;
        const bookings = await EventBooking.find({ customer: customerId })
            .populate('services.category', 'name icon')
            .populate('services.seller', 'name businessName shopName address locality city pincode mobile phone accountRefundEnabled')
            .populate('selectedProducts.productId', 'name')
            .sort({ createdAt: -1 });
        return handleResponse(res, 200, 'Event bookings fetched successfully', bookings);
    } catch (error) {
        return handleResponse(res, 500, 'Failed to fetch event bookings');
    }
};

// Get event booking details
export const getEventBookingDetails = async (req, res) => {
    try {
        const booking = await EventBooking.findById(req.params.id);
        if (!booking) {
            return handleResponse(res, 404, 'Event booking not found');
        }
        // Verify ownership
        if (booking.customer.toString() !== req.user.id && booking.customer.toString() !== req.user._id) {
            return handleResponse(res, 403, 'Unauthorized');
        }
        return handleResponse(res, 200, 'Event booking fetched successfully', booking);
    } catch (error) {
        return handleResponse(res, 500, 'Failed to fetch event booking details');
    }
};

// Update event booking
export const updateEventBooking = async (req, res) => {
    try {
        const { eventData, paymentMode, paymentStatus, overallStatus } = req.body;
        const booking = await EventBooking.findById(req.params.id);

        if (!booking) return handleResponse(res, 404, 'Booking not found');
        if (booking.customer.toString() !== req.user.id && booking.customer.toString() !== req.user._id) {
            return handleResponse(res, 403, 'Unauthorized');
        }

        // Online payment status can only be set by the verified payment API
        // (/:id/process-payment). Customers can't mark a booking PAID themselves.
        if (paymentStatus && (paymentStatus !== 'PENDING' || (Number(booking.amountPaid) || 0) > 0)) {
            return handleResponse(res, 400, 'Payment status can only be updated after a verified payment');
        }
        // Status changes allowed here: only the existing COD confirmation
        // (PAYMENT_PENDING -> CONFIRMED with paymentMode COD). Cancel uses DELETE.
        if (overallStatus) {
            const isCodConfirm = overallStatus === 'CONFIRMED'
                && booking.overallStatus === 'PAYMENT_PENDING'
                && (paymentMode || booking.paymentMode) === 'COD';
            if (!isCodConfirm) {
                return handleResponse(res, 400, 'This booking status change is not allowed');
            }
            const unavailable = await checkEventBookingStillAvailable(booking);
            if (unavailable) return handleResponse(res, 409, unavailable);
            req.closeConflictsAfterSave = true;
        }
        if (paymentMode && !['COD', 'ONLINE'].includes(paymentMode)) {
            return handleResponse(res, 400, 'Invalid payment mode');
        }

        // Update fields if provided
        if (eventData) {
            // Date & time are LOCKED once payment is done:
            // - Online: advance/full payment verified (or any money recorded)
            // - COD: booking confirmed with COD (after seller accepted) or cash confirmed
            const dateTimeLocked = (Number(booking.amountPaid) || 0) > 0
                || ['ADVANCE_PAID', 'PAID', 'REFUNDED'].includes(booking.paymentStatus)
                || (booking.paymentMode === 'COD' && ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(booking.overallStatus));
            if (dateTimeLocked) {
                const currentDate = booking.eventDate ? new Date(booking.eventDate).toISOString().slice(0, 10) : '';
                const dateChanged = Boolean(eventData.date) && String(eventData.date).slice(0, 10) !== currentDate;
                const timeChanged = Boolean(eventData.time) && String(eventData.time).trim() !== String(booking.eventTime || '').trim();
                if (dateChanged || timeChanged) {
                    return handleResponse(res, 400, 'Booking date and time are locked after payment and cannot be changed.');
                }
            }
            // Once money is paid, keep the original date for refund slabs so moving
            // the date later can't increase the refund.
            const hasPaid = (Number(booking.amountPaid) || 0) > 0 || ['PAID', 'ADVANCE_PAID'].includes(booking.paymentStatus);
            if (hasPaid && !booking.refundBaseEventDate && (eventData.date || eventData.time)) {
                booking.refundBaseEventDate = booking.eventDate;
                booking.refundBaseEventTime = booking.eventTime;
            }
            if (eventData.guestCount) booking.guestCount = parseInt(eventData.guestCount, 10);
            if (eventData.budget) booking.budget = parseInt(eventData.budget, 10);
            if (eventData.date) booking.eventDate = new Date(eventData.date);
            if (eventData.time) booking.eventTime = eventData.time;
            if (eventData.location) booking.location = { address: eventData.location };
        }

        if (paymentMode) booking.paymentMode = paymentMode;
        if (paymentStatus) booking.paymentStatus = paymentStatus;
        if (overallStatus) booking.overallStatus = overallStatus;

        const updatedBooking = await booking.save();
        if (req.closeConflictsAfterSave) await closeConflictingUnpaidBookings(updatedBooking);
        return handleResponse(res, 200, 'Event booking updated successfully', updatedBooking);
    } catch (error) {
        console.error("Update error:", error);
        return handleResponse(res, 500, 'Failed to update booking');
    }
};

export const respondToEventQuotation = async (req, res) => {
    try {
        const customerId = req.user.id || req.user._id;
        const { sellerId, action, note = '' } = req.body;
        if (!sellerId || !['APPROVE', 'REQUEST_REVISION'].includes(action)) return handleResponse(res, 400, 'Seller and valid action are required');
        const booking = await EventBooking.findById(req.params.id);
        if (!booking) return handleResponse(res, 404, 'Booking not found');
        if (String(booking.customer) !== String(customerId)) return handleResponse(res, 403, 'Unauthorized');
        const service = booking.services.find(s => String(s.seller) === String(sellerId));
        if (!service) return handleResponse(res, 404, 'Seller is not assigned to this booking');
        if (action === 'REQUEST_REVISION' && service.status === 'ACCEPTED') return handleResponse(res, 400, 'A revision cannot be requested after the seller accepts the request');
        const canRequestRevision = action === 'REQUEST_REVISION' && service.quotation?.status === 'APPROVED';
        if (service.quotation?.status !== 'PENDING_CUSTOMER' && !canRequestRevision) return handleResponse(res, 400, 'There is no quotation awaiting your response');
        if (action === 'APPROVE') {
            if (!service.quotePermissions?.customerApproval) return handleResponse(res, 403, 'Customer approval is not enabled for this seller');
            service.quotation.status = 'APPROVED';
            service.quotation.approvedAt = new Date();
        } else {
            if (!service.quotePermissions?.revision) return handleResponse(res, 403, 'Quotation revisions are not enabled for this seller');
            service.quotation.status = 'REVISION_REQUESTED';
            service.quotation.revisionNote = String(note).trim();
            service.quotation.revisionRequestedAt = new Date();
        }
        await booking.save();
        return handleResponse(res, 200, action === 'APPROVE' ? 'Quotation approved' : 'Revision requested', booking);
    } catch (error) {
        console.error('Quotation response error:', error);
        return handleResponse(res, 500, 'Failed to respond to quotation');
    }
};

// Cancel/Delete event booking
export const deleteEventBooking = async (req, res) => {
    try {
        const booking = await EventBooking.findById(req.params.id);

        if (!booking) return handleResponse(res, 404, 'Booking not found');
        if (booking.customer.toString() !== req.user.id && booking.customer.toString() !== req.user._id) {
            return handleResponse(res, 403, 'Unauthorized');
        }
        // Never cancel/refund twice.
        if (booking.overallStatus === 'CANCELLED') {
            return handleResponse(res, 400, 'Booking is already cancelled');
        }

        // Work out the refund from the refund slabs saved with the booking.
        const refund = computeEventCancellationRefund(booking);
        // Only Razorpay-verified money is auto-credited. Unverified (older) payments
        // go to review so no money is given for a payment that never happened.
        const autoCredit = refund.refundAmount > 0 && refund.isVerified;
        booking.overallStatus = 'CANCELLED';
        booking.cancellationRefund = {
            cancelledAt: new Date(),
            hoursBeforeEvent: refund.hoursBeforeEvent,
            paidAmount: refund.paidAmount,
            refundAmount: refund.refundAmount,
            refundStatus: autoCredit ? 'CREDITED_TO_WALLET' : (refund.refundAmount > 0 ? 'PENDING_REVIEW' : 'NONE'),
            lines: refund.lines,
        };
        if (autoCredit) booking.paymentStatus = 'REFUNDED';

        // COD part of the refund: the seller holds that cash, so it is recovered
        // from the seller (like real apps): first from seller earnings, and any
        // shortfall becomes a seller due (cashInHand) settled later by admin.
        const amountPaid = Number(booking.amountPaid) || 0;
        const codShare = autoCredit && amountPaid > 0
            ? Math.round(refund.refundAmount * Math.min(1, (Number(booking.codAmountCollected) || 0) / amountPaid) * 100) / 100
            : 0;
        const sellerId = booking.services?.[0]?.seller;

        // Refund method chosen by the customer. ACCOUNT (back to the original online
        // payment) is allowed only when admin enabled it for this seller; otherwise WALLET.
        let refundMethod = String(req.body?.refundMethod || req.query?.refundMethod || 'WALLET').toUpperCase() === 'ACCOUNT' ? 'ACCOUNT' : 'WALLET';
        if (refundMethod === 'ACCOUNT') {
            const sellerDoc = autoCredit && sellerId ? await Seller.findById(sellerId).select('accountRefundEnabled').lean() : null;
            if (!sellerDoc?.accountRefundEnabled) refundMethod = 'WALLET';
        }
        // Online (Razorpay) part can go back to the account; the COD cash part can't.
        const onlineShare = Math.round((refund.refundAmount - codShare) * 100) / 100;
        let walletAmount = autoCredit ? refund.refundAmount : 0;
        let accountRefunded = 0;
        const razorpayRefunds = [];

        if (autoCredit && refundMethod === 'ACCOUNT' && onlineShare > 0) {
            // Save the cancellation first so a second cancel can't refund again.
            booking.cancellationRefund.refundStatus = 'PROCESSING';
            booking.cancellationRefund.refundMethod = 'ACCOUNT';
            await booking.save();

            const razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
            let remaining = onlineShare;
            const payments = [...(booking.razorpayPayments || [])].reverse(); // newest first
            for (const p of payments) {
                if (remaining <= 0) break;
                const amount = Math.round(Math.min(remaining, Number(p.amount) || 0) * 100) / 100;
                if (amount <= 0) continue;
                try {
                    const rzpRefund = await razorpay.payments.refund(p.paymentId, {
                        amount: Math.round(amount * 100),
                        speed: 'normal',
                        notes: { bookingId: String(booking.bookingId || booking._id) },
                    });
                    razorpayRefunds.push({ paymentId: p.paymentId, refundId: rzpRefund?.id || '', amount, status: rzpRefund?.status || 'created' });
                    accountRefunded = Math.round((accountRefunded + amount) * 100) / 100;
                    remaining = Math.round((remaining - amount) * 100) / 100;
                } catch (rzpError) {
                    // If Razorpay fails, that part goes to the wallet so the customer is never stuck.
                    console.error('Razorpay refund failed:', rzpError?.error?.description || rzpError?.message);
                    break;
                }
            }
            walletAmount = Math.round((refund.refundAmount - accountRefunded) * 100) / 100;
        }

        if (autoCredit) {
            booking.cancellationRefund.refundMethod = refundMethod;
            booking.cancellationRefund.accountRefundAmount = accountRefunded;
            booking.cancellationRefund.walletRefundAmount = walletAmount;
            booking.cancellationRefund.razorpayRefunds = razorpayRefunds;
            booking.cancellationRefund.refundStatus = accountRefunded > 0
                ? (walletAmount > 0 ? 'ACCOUNT_AND_WALLET' : 'REFUNDED_TO_ACCOUNT')
                : 'CREDITED_TO_WALLET';
            // Record the Razorpay refund right away so it is never lost.
            if (accountRefunded > 0) await booking.save();
        }

        if (autoCredit) {
            // Customer credit + seller recovery + booking update commit together.
            const session = await mongoose.startSession();
            try {
                await session.withTransaction(async () => {
                    // Wallet gets the full refund (WALLET) or only what didn't go to the account.
                    if (walletAmount > 0) {
                        await creditWallet({
                            ownerType: OWNER_TYPE.CUSTOMER,
                            ownerId: booking.customer,
                            amount: walletAmount,
                            bucket: 'available',
                            session,
                            ledgerType: LEDGER_TRANSACTION_TYPE.REFUND,
                            ledgerReference: booking.bookingId,
                            ledgerDescription: `Refund for cancelled event booking ${booking.bookingId}`,
                            idempotencyKey: `event-cancel-refund-${booking._id}`,
                        });
                    }
                    if (codShare > 0 && sellerId) {
                        const sellerWallet = await getOrCreateWallet(OWNER_TYPE.SELLER, sellerId, { session });
                        const fromEarnings = Math.round(Math.min(codShare, Math.max(0, Number(sellerWallet.availableBalance) || 0)) * 100) / 100;
                        const due = Math.round((codShare - fromEarnings) * 100) / 100;
                        if (fromEarnings > 0) {
                            await debitWallet({
                                ownerType: OWNER_TYPE.SELLER,
                                ownerId: sellerId,
                                amount: fromEarnings,
                                bucket: 'available',
                                session,
                                ledgerType: LEDGER_TRANSACTION_TYPE.REFUND,
                                ledgerReference: booking.bookingId,
                                ledgerDescription: `COD refund recovered for cancelled booking ${booking.bookingId}`,
                                idempotencyKey: `event-cancel-cod-recover-${booking._id}`,
                            });
                        }
                        if (due > 0) {
                            await updateCashInHand({
                                ownerType: OWNER_TYPE.SELLER,
                                ownerId: sellerId,
                                deltaAmount: due,
                                session,
                                ledgerType: LEDGER_TRANSACTION_TYPE.ADJUSTMENT,
                                ledgerReference: booking.bookingId,
                                ledgerDescription: `COD refund due from seller for cancelled booking ${booking.bookingId}`,
                                idempotencyKey: `event-cancel-cod-due-${booking._id}`,
                            });
                        }
                        booking.cancellationRefund.codRefundFromSellerEarnings = fromEarnings;
                        booking.cancellationRefund.codRefundSellerDue = due;
                    }
                    await booking.save({ session });
                });
            } finally {
                await session.endSession();
            }
        } else {
            await booking.save();
        }

        return handleResponse(res, 200, 'Event booking cancelled successfully', { cancellationRefund: booking.cancellationRefund });
    } catch (error) {
        console.error('Cancel event booking error:', error);
        return handleResponse(res, 500, 'Failed to cancel booking');
    }
};

// Process payment after approval
export const processPaymentForBooking = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        const booking = await EventBooking.findById(req.params.id);

        if (!booking) return handleResponse(res, 404, 'Booking not found');

        // Ensure user owns booking
        if (booking.customer.toString() !== req.user.id && booking.customer.toString() !== req.user._id) {
            return handleResponse(res, 403, 'Unauthorized');
        }

        if (['CANCELLED', 'COMPLETED'].includes(booking.overallStatus)) {
            return handleResponse(res, 400, 'Booking can no longer be paid');
        }
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return handleResponse(res, 400, 'Payment details are required');
        }

        // Same payment sent twice (retry / double click) -> already counted.
        if ((booking.razorpayPayments || []).some(p => p.paymentId === razorpay_payment_id)) {
            return handleResponse(res, 200, 'Payment already recorded', booking);
        }

        // 1. Signature check (same method as ticket booking verification).
        const keySecret = process.env.RAZORPAY_KEY_SECRET;
        if (!keySecret) return handleResponse(res, 500, 'Payment gateway is not configured');
        const expectedSignature = crypto
            .createHmac('sha256', keySecret)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');
        if (expectedSignature !== razorpay_signature) {
            return handleResponse(res, 400, 'Payment verification failed');
        }

        // 2. Confirm with Razorpay that this payment is real, belongs to this
        //    order, and the order was created for this booking.
        const razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: keySecret });
        const [rzpPayment, rzpOrder] = await Promise.all([
            razorpay.payments.fetch(razorpay_payment_id),
            razorpay.orders.fetch(razorpay_order_id),
        ]);
        const receiptPrefix = `e_${String(booking._id).slice(-6)}_`;
        if (rzpPayment?.order_id !== razorpay_order_id
            || !['captured', 'authorized'].includes(rzpPayment?.status)
            || !String(rzpOrder?.receipt || '').startsWith(receiptPrefix)) {
            return handleResponse(res, 400, 'Payment does not match this booking');
        }

        const wasLockedBeforePayment = isEventBookingCalendarLocked(booking);
        // 3. First payment only: the slot must still be free (another customer may
        //    have paid first). If not, give this money back right away.
        const unavailable = await checkEventBookingStillAvailable(booking);
        if (unavailable) {
            try {
                await razorpay.payments.refund(razorpay_payment_id, { amount: Math.round(Number(rzpPayment.amount || 0)) });
            } catch (refundError) {
                console.error('Event slot taken - refund failed:', refundError?.message || refundError);
            }
            return handleResponse(res, 409, `${unavailable} Your payment will be refunded.`);
        }

        // 4. Record the verified money and set status from what was really paid.
        const amount = Math.round(Number(rzpPayment.amount || 0)) / 100;
        booking.razorpayPayments = [...(booking.razorpayPayments || []), {
            paymentId: razorpay_payment_id,
            orderId: razorpay_order_id,
            amount,
            paidAt: new Date(),
        }];
        booking.amountPaid = Math.round(((Number(booking.amountPaid) || 0) + amount) * 100) / 100;
        booking.paymentHoldUntil = undefined;
        booking.paymentMode = 'ONLINE';
        const total = Number(booking.totalAmount) || 0;
        booking.paymentStatus = booking.amountPaid >= total - 0.5 ? 'PAID' : 'ADVANCE_PAID';
        if (booking.overallStatus === 'PAYMENT_PENDING') booking.overallStatus = 'CONFIRMED';
        // Lock the refund base date at the first payment.
        if (!booking.refundBaseEventDate) {
            booking.refundBaseEventDate = booking.eventDate;
            booking.refundBaseEventTime = booking.eventTime;
        }

        const updatedBooking = await booking.save();
        if (!wasLockedBeforePayment) await closeConflictingUnpaidBookings(updatedBooking);

        // Payment done -> notification only (no ringtone): seller(s) + customer.
        try {
            const amountText = `₹${Number(amount).toLocaleString('en-IN')}`;
            const isFull = booking.paymentStatus === 'PAID';
            const sellerIds = [...new Set((booking.services || []).map(s => String(s.seller || '')).filter(Boolean))];
            sellerIds.forEach(sellerId => {
                emitSellerNotification('EVENT_BOOKING_PAYMENT_RECEIVED', {
                    userId: sellerId,
                    bookingId: booking._id,
                    message: `${isFull ? 'Full' : 'Advance'} payment of ${amountText} received online for booking ${booking.bookingId}.`
                });
            });
            emitCustomerNotification('EVENT_BOOKING_PAYMENT_CONFIRMED', {
                userId: booking.customer,
                bookingId: booking._id,
                message: `Your ${isFull ? '' : 'advance '}payment of ${amountText} for booking ${booking.bookingId} was successful.`
            });
        } catch (notifyError) {
            console.error('Payment notification error:', notifyError);
        }

        return handleResponse(res, 200, 'Payment processed and booking confirmed', updatedBooking);
    } catch (error) {
        console.error("Payment process error:", error);
        return handleResponse(res, 500, 'Failed to process payment');
    }
};

// Mark event as completed and create payout
export const completeEventBooking = async (req, res) => {
    try {
        const booking = await EventBooking.findById(req.params.id);
        if (!booking) return handleResponse(res, 404, 'Booking not found');

        // Only seller or admin can complete
        const isOwnerSeller = booking.services.some(s => s.seller && s.seller.toString() === (req.user.sellerId || req.user.id || req.user._id));
        if (!isOwnerSeller && req.user.role !== 'admin') {
            return handleResponse(res, 403, 'Unauthorized');
        }

        if (booking.overallStatus !== 'CONFIRMED') {
            return handleResponse(res, 400, 'Booking must be CONFIRMED before it can be marked COMPLETED');
        }
        // Only after the booked slot's start date & time.
        const eventStart = getSlotStartIST(booking);
        if (eventStart && Date.now() < eventStart.getTime()) {
            return handleResponse(res, 400, `You can mark this booking as completed only after the event starts (${formatIST(eventStart)}).`);
        }

        booking.overallStatus = 'COMPLETED';
        if (!booking.completedAt) {
            booking.completedAt = new Date();
        }
        await booking.save();

        // Fetch GASP Pricing Engine setting for default commission
        const globalSettings = await Setting.findOne({});
        const globalEventFee = globalSettings?.pricingControl?.commissionPercentage ?? 5;

        // Generate Payouts for each accepted seller service
        for (const service of booking.services) {
            if (service.status === 'ACCEPTED' || service.status === 'CONFIRMED') {
                const seller = await Seller.findById(service.seller);
                const commissionRate = seller?.commissionRate || globalEventFee;

                // Simplified payout logic: Assuming the total amount is evenly split for now if multi-seller
                // In production, amount per service should be used.
                const validServicesCount = booking.services.filter(s => s.status === 'ACCEPTED' || s.status === 'CONFIRMED').length;
                const serviceAmount = booking.totalAmount / validServicesCount;

                const commissionDeducted = (serviceAmount * commissionRate) / 100;
                const netPayoutAmount = serviceAmount - commissionDeducted;

                // Check if payout already exists
                const existingPayout = await EventPayout.findOne({ bookingId: booking._id, sellerId: service.seller });
                if (!existingPayout) {
                    await EventPayout.create({
                        sellerId: service.seller,
                        bookingId: booking._id,
                        totalAmount: serviceAmount,
                        commissionRate: commissionRate,
                        commissionDeducted: commissionDeducted,
                        netPayoutAmount: netPayoutAmount,
                        paymentMode: booking.paymentMode,
                        status: 'PENDING'
                    });
                }
            }
        }

        return handleResponse(res, 200, 'Event completed and payout generated');
    } catch (error) {
        console.error("Complete event error:", error);
        return handleResponse(res, 500, 'Failed to complete event');
    }
};

// Get alternative sellers for a rejected service
export const getAlternativeSellers = async (req, res) => {
    try {
        const booking = await EventBooking.findById(req.params.id);
        if (!booking) return handleResponse(res, 404, 'Booking not found');

        const { categoryId } = req.params;

        // Find sellers in the same category
        const alternatives = await Seller.find({
            isActive: true,
            isVerified: true,
            isEventSeller: true,
            serviceCategories: categoryId
        }).sort({ reliabilityScore: -1 }).limit(10); // Sort by reliability

        return handleResponse(res, 200, 'Alternative sellers fetched', alternatives);
    } catch (error) {
        console.error("Alternative sellers error:", error);
        return handleResponse(res, 500, 'Failed to fetch alternative sellers');
    }
};

// Reassign a rejected service to a new seller
export const reassignSeller = async (req, res) => {
    try {
        const booking = await EventBooking.findById(req.params.id);
        if (!booking) return handleResponse(res, 404, 'Booking not found');

        const { categoryId, newSellerId } = req.body;
        if (!categoryId || !newSellerId) {
            return handleResponse(res, 400, 'Category ID and New Seller ID required');
        }

        // Ensure user owns booking
        if (booking.customer.toString() !== req.user.id && booking.customer.toString() !== req.user._id) {
            return handleResponse(res, 403, 'Unauthorized');
        }

        let updated = false;
        booking.services.forEach(s => {
            if (s.category && s.category.toString() === categoryId && s.status === 'REJECTED') {
                s.seller = newSellerId;
                s.status = 'PENDING_APPROVAL';
                updated = true;
            }
        });

        if (!updated) {
            return handleResponse(res, 400, 'No rejected service found for the given category');
        }

        booking.overallStatus = 'PENDING'; // Reset overall status
        await booking.save();

        // Notify new seller
        emitSellerNotification('NEW_EVENT_BOOKING_REQUEST', {
            userId: newSellerId,
            bookingId: booking._id,
            message: 'New booking received'
        });

        return handleResponse(res, 200, 'Seller reassigned successfully', booking);
    } catch (error) {
        console.error("Reassign seller error:", error);
        return handleResponse(res, 500, 'Failed to reassign seller');
    }
};

export const getSellerBookedSlots = async (req, res) => {
    try {
        const { sellerId } = req.params;
        const { date, uniqueCode } = req.query;

        if (!sellerId || !date) {
            return handleResponse(res, 400, "Seller ID and date are required");
        }

        const targetDate = new Date(date);
        const startOfDay = new Date(targetDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(targetDate);
        endOfDay.setHours(23, 59, 59, 999);

        // Find confirmed/pending bookings for this seller on targetDate
        const [bookings, sellerConfig] = await Promise.all([EventBooking.find({
            "services.seller": sellerId,
            eventDate: { $gte: startOfDay, $lte: endOfDay },
            overallStatus: { $nin: ['CANCELLED', 'REJECTED'] }
        }).select('eventTime multipleEvents selectedProducts selectedShop amountPaid paymentStatus paymentMode overallStatus'), Seller.findById(sellerId).select('shopsAtLocation').lean()]);
        // Only paid bookings hold a slot (unpaid requests don't lock the calendar).
        const paidBookings = bookings.filter(isEventBookingCalendarLocked);

        const sellerShops = Array.isArray(sellerConfig?.shopsAtLocation) ? sellerConfig.shopsAtLocation : [];
        const resolveBookingShop = (booking) => {
            if (booking.selectedShop?.uniqueCode || booking.selectedShop?.shopNo) return booking.selectedShop;
            return (booking.selectedProducts || []).map(line => {
                const code = String(line.uniqueCode || line.selectedVariant?.uniqueCode || '').trim().toUpperCase();
                const shopNo = String(line.shopNo || line.selectedVariant?.shopNo || '').trim();
                return sellerShops.find(shop =>
                    (code && String(shop.uniqueCode || '').trim().toUpperCase() === code) ||
                    (shopNo && String(shop.shopNo || '').trim() === shopNo)
                );
            }).find(Boolean) || null;
        };

        const bookedSlots = new Set();
        const shopUsageBySlot = {};
        // Keep per-variant usage as well.  The customer UI uses this data to
        // disable only the selected product variant, not the whole time slot.
        const variantUsageBySlot = {};
        const productVariantUsageBySlot = {};
        const productVariantUsageByDate = {};
        const addVariantUsage = (productId, code, slot, quantity) => {
            const normalizedCode = String(code || '').trim().toUpperCase();
            const normalizedSlot = String(slot || '').trim();
            const normalizedProductId = String(productId || '').trim();
            if (!normalizedProductId || !normalizedCode || !normalizedSlot) return;
            if (!variantUsageBySlot[normalizedCode]) variantUsageBySlot[normalizedCode] = {};
            variantUsageBySlot[normalizedCode][normalizedSlot] =
                (variantUsageBySlot[normalizedCode][normalizedSlot] || 0) + (Number(quantity) || 1);
            if (!productVariantUsageBySlot[normalizedProductId]) productVariantUsageBySlot[normalizedProductId] = {};
            if (!productVariantUsageBySlot[normalizedProductId][normalizedCode]) {
                productVariantUsageBySlot[normalizedProductId][normalizedCode] = {};
            }
            productVariantUsageBySlot[normalizedProductId][normalizedCode][normalizedSlot] =
                (productVariantUsageBySlot[normalizedProductId][normalizedCode][normalizedSlot] || 0) + (Number(quantity) || 1);
        };

        // Product date usage is keyed by UNIQUE CODE (not productId), so every
        // product/variant sharing a product-capacity code shares its capacity.
        const addProductDateUsage = (code, quantity) => {
            const normalizedCode = String(code || '').trim().toUpperCase();
            if (!normalizedCode) return;
            productVariantUsageByDate[normalizedCode] =
                (productVariantUsageByDate[normalizedCode] || 0) + (Number(quantity) || 1);
        };

        const addShopUsage = (shop, slot) => {
            const code = String(shop?.uniqueCode || '').trim().toUpperCase();
            const shopNo = String(shop?.shopNo || '').trim();
            const key = code || (shopNo ? `SHOP_NO:${shopNo}` : '');
            const normalizedSlot = String(slot || '').trim();
            if (!key || !normalizedSlot) return;
            if (!shopUsageBySlot[key]) shopUsageBySlot[key] = {};
            shopUsageBySlot[key][normalizedSlot] = (shopUsageBySlot[key][normalizedSlot] || 0) + 1;
        };

        paidBookings.forEach(b => {
            const bookingSlots = [
                b.eventTime,
                ...(Array.isArray(b.multipleEvents)
                    ? b.multipleEvents
                        .filter(me => String(me.date || date).trim() === String(date).trim())
                        .map(me => me.time)
                    : [])
            ].filter(Boolean);

            const bookingVariants = (b.selectedProducts || [])
                .map(product => ({
                    productId: product.productId,
                    code: product.uniqueCode || product.selectedVariant?.uniqueCode,
                    quantity: product.quantity
                }))
                .filter(product => product.code);

            // Product date usage counts only product-capacity variants; shop-capacity
            // variants are tracked separately in shopUsageBySlot.
            bookingVariants
                .filter(product => !sellerShops.some(shop =>
                    String(shop.uniqueCode || '').trim().toUpperCase() === String(product.code).trim().toUpperCase()
                    && String(shop.capacityType || 'SHOP CAPECITY').trim().toUpperCase().includes('SHOP')))
                .forEach(product => addProductDateUsage(product.code, product.quantity));

            bookingSlots.forEach(slot => {
                bookedSlots.add(slot);
                addShopUsage(resolveBookingShop(b), slot);
                bookingVariants.forEach(product => addVariantUsage(product.productId, product.code, slot, product.quantity));
            });
        });

        // Also check SellerVenueAvailability if any venue belongs to seller
        const venueAvailability = await (await import('../models/event/SellerVenueAvailability.js')).default.findOne({
            sellerId,
            date: { $gte: startOfDay, $lte: endOfDay }
        }).select('bookedSlots');

        if (venueAvailability && Array.isArray(venueAvailability.bookedSlots)) {
            venueAvailability.bookedSlots.forEach(s => bookedSlots.add(s));
        }

        const normalizedRequestedCode = String(uniqueCode || '').trim().toUpperCase();
        const requestedCodeUsage = variantUsageBySlot[normalizedRequestedCode] || {};

        return handleResponse(res, 200, "Booked slots fetched successfully", {
            // Kept for backward compatibility with existing consumers.
            bookedSlots: uniqueCode ? Object.keys(requestedCodeUsage) : Array.from(bookedSlots),
            variantUsageBySlot,
            productVariantUsageBySlot,
            productVariantUsageByDate,
            shopUsageBySlot
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// Submit Rating & Review for Event Booking (Customer reviewing Seller)
export const submitEventBookingReview = async (req, res) => {
    try {
        const { id } = req.params;
        const { rating, review } = req.body;
        const customerId = req.user.id || req.user._id;

        const numRating = Number(rating);
        if (!numRating || numRating < 1 || numRating > 5) {
            return handleResponse(res, 400, "Rating must be between 1 and 5 stars");
        }

        const booking = await EventBooking.findById(id);
        if (!booking) {
            return handleResponse(res, 404, "Booking not found");
        }

        // Verify ownership
        if (booking.customer?.toString() !== customerId?.toString()) {
            return handleResponse(res, 403, "Unauthorized to review this booking");
        }

        if (booking.overallStatus !== 'COMPLETED') {
            return handleResponse(res, 400, "Reviews can only be submitted for COMPLETED events");
        }

        booking.sellerRating = numRating;
        booking.sellerReview = String(review || '').trim();
        booking.sellerReviewedAt = new Date();

        // Also update service ratings
        if (Array.isArray(booking.services) && booking.services.length > 0) {
            booking.services.forEach(service => {
                service.rating = numRating;
                if (review) service.review = String(review).trim();
            });
        }

        await booking.save();

        // Dynamically update seller rating in DB
        try {
            const Seller = await import('../models/seller.js').then(m => m.default);
            for (const s of booking.services) {
                if (s.seller) {
                    const sellerDoc = await Seller.findById(s.seller);
                    if (sellerDoc) {
                        const currentTotalRatings = Number(sellerDoc.totalRatings || sellerDoc.reviewsCount || 0);
                        const currentAvg = Number(sellerDoc.rating || 0);
                        const newTotal = currentTotalRatings + 1;
                        const newAvg = Number(((currentAvg * currentTotalRatings + numRating) / newTotal).toFixed(1));

                        sellerDoc.rating = newAvg;
                        sellerDoc.totalRatings = newTotal;
                        sellerDoc.reviewsCount = newTotal;
                        await sellerDoc.save();

                        // Emit real-time notification to the seller
                        const { emitSellerNotification } = await import('../modules/notifications/notification.service.js');
                        const { NOTIFICATION_EVENTS } = await import('../modules/notifications/notification.constants.js');
                        emitSellerNotification(NOTIFICATION_EVENTS.EVENT_REVIEW_REMINDER, {
                            userId: s.seller,
                            bookingId: booking._id,
                            title: "New Customer Review Received!",
                            message: `Customer rated your service with ${numRating}⭐: "${String(review || 'Great service!').slice(0, 80)}"`,
                            data: {
                              rating: numRating,
                              bookingId: booking._id
                            }
                        });
                    }
                }
            }
        } catch (sellerErr) {
            console.error("Error updating seller rating:", sellerErr);
        }

        return handleResponse(res, 200, "Review submitted successfully", {
            sellerRating: booking.sellerRating,
            sellerReview: booking.sellerReview,
            sellerReviewedAt: booking.sellerReviewedAt
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// Get Event Booking Review
export const getEventBookingReview = async (req, res) => {
    try {
        const { id } = req.params;
        const booking = await EventBooking.findById(id).select('bookingId sellerRating sellerReview sellerReviewedAt services overallStatus');
        if (!booking) {
            return handleResponse(res, 404, "Booking not found");
        }
        return handleResponse(res, 200, "Review details fetched successfully", booking);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};
