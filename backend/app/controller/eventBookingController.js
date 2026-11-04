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
import { getBookingStart, isBookingWithinAdvanceNotice } from '../utils/advanceBooking.js';

// Create a new event booking
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
            }).select('_id name price salePrice colors variants hasAddOn fixedAddOns clickBoxAddOns').lean();

            const productsById = new Map(productDocs.map(product => [String(product._id), product]));
            if (selectedProductLines.some(line => !productsById.has(String(line.productId)))) {
                return handleResponse(res, 400, "One or more selected products are unavailable for this seller");
            }
            selectedProductLines = selectedProductLines.map(line => {
                const doc = productsById.get(String(line.productId));
                const finalPrice = line.price > 0 ? line.price : (doc.salePrice || doc.price || 0);
                const addOnTotal = (line.selectedAddOns || []).reduce((s, a) => s + (Number(a.price) || 0), 0);
                return {
                    ...line,
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

        const sellerForAdvanceCheck = await Seller.findById(sellerId).select('advanceBookingBufferEnabled advanceBookingBuffer advanceBookingBufferUnit advanceBookingBufferTime').lean();
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

            // Count existing accepted bookings for this seller on this date
            const startOfDay = new Date(eventDateStr);
            const endOfDay = new Date(startOfDay);
            endOfDay.setDate(endOfDay.getDate() + 1);

            const bookingsOnDate = await EventBooking.find({
                "services.seller": sellerId,
                eventDate: { $gte: startOfDay, $lt: endOfDay },
                overallStatus: { $nin: ['CANCELLED', 'REJECTED'] }
            });

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
            // was selected. Pending requests reserve capacity too; cancelled and
            // rejected bookings do not.
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
                if (!shop) return handleResponse(res, 400, 'Selected shop is not configured for this seller');
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
                    return handleResponse(res, 400, 'This variant is already booked for the selected date and time slot.');
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
                if (!variant) return handleResponse(res, 400, `Product code ${code} is not configured for this product`);
                const capacityType = String(variant.capacityType || '').trim().toUpperCase();
                // Shop-capacity variants are validated only by the shop block above.
                // Never apply product date capacity to a shop-capacity variant.
                if (capacityType.includes('SHOP')) continue;
                const lineCodeOf = (l) => String(l?.uniqueCode || l?.selectedVariant?.uniqueCode || '').trim().toUpperCase();
                const productBookings = bookingsOnDate.flatMap(b => (b.selectedProducts || [])
                    .filter(existing => lineCodeOf(existing) === code));
                const type = String(variant.bookingType || 'MULTIPLE').toUpperCase();
                const minimum = Number(variant.minimum || 0);
                if (minimum > 0 && line.quantity < minimum) {
                    return handleResponse(res, 400, `Product code ${code} requires a minimum quantity of ${minimum}.`);
                }
                if (type === 'SINGLE' && productBookings.length > 0) {
                    return handleResponse(res, 400, 'This variant is already booked on this date.');
                }
                const max = Number(variant.maximum || variant.totalCapacity || 0);
                const requestedProductQuantity = selectedProductLines
                    .filter(selected => lineCodeOf(selected) === code)
                    .reduce((sum, selected) => sum + (Number(selected.quantity) || 0), 0);
                const used = productBookings.reduce((sum, existing) => sum + (Number(existing.quantity) || 0), 0);
                if (type !== 'SINGLE' && max > 0 && used + requestedProductQuantity > max) {
                    return handleResponse(res, 400, 'This product is already fully booked on this date.');
                }
            }

            const existingBookingsCount = bookingsOnDate.length;
            const numberOfShops = seller.numberOfShops || 1;
            
            if (!hasProductCapacityLines && seller.bookingType === 'one_time') {
                if (existingBookingsCount >= numberOfShops) {
                    return handleResponse(res, 400, "The selected provider has reached their maximum booking capacity for this date (One-time bookings full).");
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
                    return handleResponse(res, 400, `The selected provider does not have enough capacity on this date. Available capacity: ${maxAllowedCapacity - consumedCapacity}`);
                }
            }
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
                    message: `New event booking request: ${eventData.eventType} for ${eventData.guestCount} guests. Please review and approve.`
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
            .populate('services.seller', 'name businessName mobile')
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

        // Update fields if provided
        if (eventData) {
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

        booking.overallStatus = 'CANCELLED';
        await booking.save();

        return handleResponse(res, 200, 'Event booking cancelled successfully');
    } catch (error) {
        return handleResponse(res, 500, 'Failed to cancel booking');
    }
};

// Process payment after approval
export const processPaymentForBooking = async (req, res) => {
    try {
        const { paymentDetails } = req.body;
        const booking = await EventBooking.findById(req.params.id);

        if (!booking) return handleResponse(res, 404, 'Booking not found');

        // Ensure user owns booking
        if (booking.customer.toString() !== req.user.id && booking.customer.toString() !== req.user._id) {
            return handleResponse(res, 403, 'Unauthorized');
        }

        if (booking.overallStatus !== 'PAYMENT_PENDING') {
            return handleResponse(res, 400, 'Booking is not awaiting payment');
        }

        // Verify Razorpay details here if needed. 
        // For now, we trust the frontend success (standard integration).

        booking.paymentStatus = 'PAID';
        booking.overallStatus = 'CONFIRMED';

        const updatedBooking = await booking.save();
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
            message: `New event booking request: ${booking.eventType} for ${booking.guestCount} guests. Please review and approve.`
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
        }).select('eventTime multipleEvents selectedProducts selectedShop'), Seller.findById(sellerId).select('shopsAtLocation').lean()]);

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

        bookings.forEach(b => {
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
