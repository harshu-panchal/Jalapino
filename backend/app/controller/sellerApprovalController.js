import EventBooking from '../models/event/EventBooking.js';
import handleResponse from '../utils/helper.js';
import { emitCustomerNotification } from '../modules/notifications/notification.service.js';

// Get all event requests for the logged-in seller
export const getEventRequests = async (req, res) => {
    try {
        const sellerId = req.user.id || req.user._id;

        // Find all bookings where this seller is part of the services array
        const bookings = await EventBooking.find({
            'services.seller': sellerId
        }).populate('customer', 'name email phone').sort({ createdAt: -1 });

        // Map and filter down to just what the seller needs to see
        const requests = bookings.map(booking => {
            const myService = booking.services.find(s => s.seller && s.seller.toString() === sellerId.toString());
            return {
                bookingId: booking.bookingId,
                _id: booking._id,
                customer: booking.customer,
                eventType: booking.eventType,
                eventDate: booking.eventDate,
                eventTime: booking.eventTime,
                guestCount: booking.guestCount,
                location: booking.location,
                overallStatus: booking.overallStatus,
                myServiceStatus: myService ? myService.status : 'UNKNOWN',
                serviceDetails: myService
            };
        });

        return handleResponse(res, 200, 'Event requests fetched successfully', requests);
    } catch (error) {
        console.error("Fetch Event Requests error:", error);
        return handleResponse(res, 500, 'Failed to fetch event requests');
    }
};

// Accept or Reject an event request
export const updateRequestStatus = async (req, res) => {
    try {
        const sellerId = req.user.id || req.user._id;
        const bookingId = req.params.id;
        const { status, sellerNotes } = req.body; // status should be 'ACCEPTED' or 'REJECTED'

        if (!['ACCEPTED', 'REJECTED'].includes(status)) {
            return handleResponse(res, 400, 'Invalid status');
        }

        const booking = await EventBooking.findById(bookingId);
        if (!booking) {
            return handleResponse(res, 404, 'Booking not found');
        }

        // Find ALL services that belong to this seller and update them
        let updatedAny = false;
        booking.services.forEach(s => {
            if (s.seller && s.seller.toString() === sellerId.toString()) {
                s.status = status;
                if (sellerNotes) {
                    s.sellerNotes = sellerNotes;
                }
                updatedAny = true;
            }
        });

        if (!updatedAny) {
            return handleResponse(res, 403, 'You are not assigned to this booking');
        }

        // --- ORCHESTRATION ENGINE ---
        // Check if all services in this booking are ACCEPTED
        const allAccepted = booking.services.every(s => s.status === 'ACCEPTED');
        const anyRejected = booking.services.some(s => s.status === 'REJECTED');

        if (anyRejected) {
            // If any seller rejects, notify customer so they can pick alternative
            emitCustomerNotification('EVENT_BOOKING_REJECTED', {
                userId: booking.customer,
                bookingId: booking._id,
                message: `One of your requested providers has rejected the booking. Please select an alternative.`
            });
        } else if (allAccepted) {
            // ALL SELLERS APPROVED! PAYMENT ENABLED.
            booking.overallStatus = 'PAYMENT_PENDING';

            emitCustomerNotification('EVENT_BOOKING_APPROVED', {
                userId: booking.customer,
                bookingId: booking._id,
                message: `All providers have approved your booking! You can now proceed to payment.`
            });
        }

        await booking.save();

        // --- RELIABILITY ENGINE ---
        try {
            const sellerDoc = await import('../models/seller.js').then(m => m.default.findById(sellerId));
            if (sellerDoc) {
                const responseTimeMins = Math.round((Date.now() - booking.createdAt.getTime()) / 60000);
                const newTotal = (sellerDoc.totalRequests || 0) + 1;

                let newAccepted = sellerDoc.acceptedRequests || 0;
                let newRejected = sellerDoc.rejectedRequests || 0;
                let newAvgResponse = sellerDoc.avgResponseTimeMins || 0;

                if (status === 'ACCEPTED') {
                    newAccepted++;
                    newAvgResponse = Math.round(((sellerDoc.avgResponseTimeMins || 0) * (newTotal - 1) + responseTimeMins) / newTotal);
                } else if (status === 'REJECTED') {
                    newRejected++;
                }

                const reliability = Math.round((newAccepted / newTotal) * 100);

                await import('../models/seller.js').then(m => m.default.findByIdAndUpdate(sellerId, {
                    totalRequests: newTotal,
                    acceptedRequests: newAccepted,
                    rejectedRequests: newRejected,
                    avgResponseTimeMins: newAvgResponse,
                    reliabilityScore: reliability
                }));
            }
        } catch (e) {
            console.error("Reliability Engine error:", e);
        }
        // --------------------------

        return handleResponse(res, 200, `Booking request ${status.toLowerCase()} successfully`, booking);
    } catch (error) {
        console.error("Update Request Status error:", error);
        return handleResponse(res, 500, 'Failed to update request status');
    }
};
