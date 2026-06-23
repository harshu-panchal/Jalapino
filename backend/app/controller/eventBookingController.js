import EventBooking from '../models/event/EventBooking.js';
import EventReservation from '../models/event/EventReservation.js';
import handleResponse from '../utils/helper.js';

// Create a new event booking
export const createEventBooking = async (req, res) => {
    try {
        const { eventData, preferences, selectedCategories, paymentMethod, paymentDetails, amount } = req.body;
        const customerId = req.user.id || req.user._id;

        // Create booking ID
        const bookingId = `EVT-${Date.now()}`;

        // Map categories to services format
        const services = (selectedCategories || []).map(cat => {
            const catId = typeof cat === 'object' ? (cat._id || cat.id) : cat;
            const catPreferences = preferences ? preferences[catId] : {};
            
            return {
                seller: req.body.sellerId || null,
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
            paymentStatus: paymentMethod === 'COD' ? 'PENDING' : 'PAID',
            paymentMode: paymentMethod === 'COD' ? 'COD' : 'ONLINE',
            totalAmount: amount || 0,
            overallStatus: 'CONFIRMED'
        });

        const savedBooking = await newBooking.save();

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
        const bookings = await EventBooking.find({ customer: customerId }).sort({ createdAt: -1 });
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
        const { eventData } = req.body;
        const booking = await EventBooking.findById(req.params.id);
        
        if (!booking) return handleResponse(res, 404, 'Booking not found');
        if (booking.customer.toString() !== req.user.id && booking.customer.toString() !== req.user._id) {
            return handleResponse(res, 403, 'Unauthorized');
        }

        // Update fields if provided
        if (eventData.guestCount) booking.guestCount = parseInt(eventData.guestCount, 10);
        if (eventData.budget) booking.budget = parseInt(eventData.budget, 10);
        if (eventData.date) booking.eventDate = new Date(eventData.date);
        if (eventData.time) booking.eventTime = eventData.time;
        if (eventData.location) booking.location = { address: eventData.location };

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
