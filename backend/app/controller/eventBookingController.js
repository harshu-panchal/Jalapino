import Setting from '../models/setting.js';
import EventBooking from '../models/event/EventBooking.js';
import EventReservation from '../models/event/EventReservation.js';
import EventPayout from '../models/event/EventPayout.js';
import SellerCalendar from '../models/event/SellerCalendar.js';
import Seller from '../models/seller.js';
import handleResponse from '../utils/helper.js';
import { emitSellerNotification, emitCustomerNotification } from '../modules/notifications/notification.service.js';

// Create a new event booking
export const createEventBooking = async (req, res) => {
    try {
        const { eventData, preferences, selectedCategories, paymentMethod, paymentDetails, amount, sellerId } = req.body;
        const customerId = req.user.id || req.user._id;

        if (!sellerId) {
            return handleResponse(res, 400, "Seller is required for booking");
        }

        // Fetch GASP Global Settings
        const globalSettings = await Setting.findOne({});
        
        // --- GASP BOOKING ENGINE: Booking Window Validation ---
        const eventDateObj = new Date(eventData.date || Date.now());
        const eventDateStr = eventDateObj.toISOString().split('T')[0];
        const daysDifference = Math.ceil((eventDateObj.getTime() - Date.now()) / (1000 * 3600 * 24));
        const maxAdvanceDays = globalSettings?.bookingControl?.bookingWindowDays ?? 365;
        
        if (daysDifference > maxAdvanceDays) {
            return handleResponse(res, 400, `Booking rejected by GASP: You cannot book an event more than ${maxAdvanceDays} days in advance.`);
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
            if (seller.maxGuestCapacity && requestedGuests > seller.maxGuestCapacity) {
                return handleResponse(res, 400, `The requested guest count exceeds the provider's maximum capacity of ${seller.maxGuestCapacity}.`);
            }

            // Count existing accepted bookings for this seller on this date
            const startOfDay = new Date(eventDateStr);
            const endOfDay = new Date(startOfDay);
            endOfDay.setDate(endOfDay.getDate() + 1);

            const existingBookings = await EventBooking.countDocuments({
                "services.seller": sellerId,
                eventDate: { $gte: startOfDay, $lt: endOfDay },
                overallStatus: { $nin: ['CANCELLED', 'REJECTED'] },
                "services.status": { $in: ['ACCEPTED', 'CONFIRMED'] }
            });

            if (existingBookings >= (seller.maxEventsPerDay || 2)) {
                return handleResponse(res, 400, "The selected provider has reached their maximum booking capacity for this date.");
            }
        }
        // -------------------------------------------------------

        // Create booking ID
        const bookingId = `EVT-${Date.now()}`;

        // Map categories to services format
        const services = (selectedCategories || []).map(cat => {
            const catId = typeof cat === 'object' ? (cat._id || cat.id) : cat;
            const catPreferences = preferences ? preferences[catId] : {};

            return {
                seller: sellerId,
                category: catId || null,
                preferences: Object.keys(catPreferences || {}).map(key => ({
                    fieldName: key,
                    value: catPreferences[key]
                }))
            };
        });

        // Create the booking entry
        const newBooking = new EventBooking({
            bookingId: bookingId,
            customer: customerId,
            eventType: eventData.eventType || 'Custom',
            eventDate: new Date(eventData.date || Date.now()),
            eventTime: eventData.time || '10:00 AM',
            location: {
                address: eventData.location || 'Pending Address'
            },
            guestCount: parseInt(eventData.guestCount, 10) || 1,
            budget: parseInt(eventData.budget, 10) || 0,
            services: services,
            paymentStatus: 'PENDING',
            paymentMode: paymentMethod || 'ONLINE', // Will be finalized later
            totalAmount: amount || 0,
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
