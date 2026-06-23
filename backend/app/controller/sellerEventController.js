import EventBooking from '../models/event/EventBooking.js';
import handleResponse from '../utils/helper.js';

// Get dashboard stats
export const getEventDashboardStats = async (req, res) => {
    try {
        const sellerId = req.user.sellerId || req.user.id;

        // Query bookings where this seller is assigned to at least one service
        const query = { "services.seller": sellerId };

        const totalReservations = await EventBooking.countDocuments(query);
        
        // Count pending (services status PENDING_APPROVAL)
        const pendingRequests = await EventBooking.countDocuments({
            ...query,
            "services": { $elemMatch: { seller: sellerId, status: "PENDING_APPROVAL" } }
        });

        // Count confirmed (services status ACCEPTED)
        const upcomingEvents = await EventBooking.countDocuments({
            ...query,
            "services": { $elemMatch: { seller: sellerId, status: "ACCEPTED" } }
        });
        
        // Find recent requests
        const recentRequestsRaw = await EventBooking.find(query)
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('customer', 'name email phone')
            .lean();

        // Format for dashboard
        const recentRequests = recentRequestsRaw.map(booking => {
            const sellerService = booking.services.find(s => s.seller?.toString() === sellerId?.toString());
            let mappedStatus = 'pending';
            if (sellerService) {
                if (sellerService.status === 'ACCEPTED') mappedStatus = 'confirmed';
                if (sellerService.status === 'REJECTED') mappedStatus = 'rejected';
            }

            return {
                _id: booking._id,
                customerInfo: {
                    name: booking.customer?.name || "Customer",
                },
                status: mappedStatus,
                eventDate: booking.eventDate,
                guestCount: booking.guestCount
            };
        });

        const stats = {
            totalReservations,
            pendingRequests,
            upcomingEvents,
            recentRequests
        };

        return handleResponse(res, 200, 'Dashboard stats fetched successfully', stats);
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        return handleResponse(res, 500, 'Failed to fetch dashboard stats');
    }
};

// Get all reservations for the seller
export const getEventReservations = async (req, res) => {
    try {
        const sellerId = req.user.sellerId || req.user.id;
        const bookings = await EventBooking.find({ "services.seller": sellerId })
            .populate('customer', 'name email phone')
            .sort({ createdAt: -1 })
            .lean();

        const reservations = bookings.map(booking => {
            const sellerService = booking.services.find(s => s.seller?.toString() === sellerId?.toString());
            let mappedStatus = 'pending';
            if (sellerService) {
                if (sellerService.status === 'ACCEPTED') mappedStatus = 'confirmed';
                if (sellerService.status === 'REJECTED') mappedStatus = 'rejected';
            }

            // Convert preferences array to object for the frontend modal
            const customerPreferences = {};
            if (sellerService && sellerService.preferences) {
                sellerService.preferences.forEach(pref => {
                    customerPreferences[pref.fieldName] = pref.value;
                });
            }

            return {
                _id: booking._id,
                customerInfo: {
                    name: booking.customer?.name || "Customer",
                    phone: booking.customer?.phone || "",
                    email: booking.customer?.email || ""
                },
                status: mappedStatus,
                eventDate: booking.eventDate,
                eventTime: booking.eventTime,
                guestCount: booking.guestCount,
                location: booking.location,
                customerPreferences: customerPreferences,
                createdAt: booking.createdAt,
                amount: sellerService ? (sellerService.amount || booking.totalAmount) : booking.totalAmount
            };
        });

        return handleResponse(res, 200, 'Reservations fetched successfully', reservations);
    } catch (error) {
        console.error('Error fetching reservations:', error);
        return handleResponse(res, 500, 'Failed to fetch reservations');
    }
};

// Update reservation status (Accept/Reject)
export const updateReservationStatus = async (req, res) => {
    try {
        const sellerId = req.user.sellerId || req.user.id;
        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = ['pending', 'active', 'confirmed', 'completed', 'cancelled', 'rejected'];
        if (!validStatuses.includes(status)) {
            return handleResponse(res, 400, 'Invalid status');
        }

        const booking = await EventBooking.findOne({ _id: id, "services.seller": sellerId });
        if (!booking) {
            return handleResponse(res, 404, 'Reservation not found');
        }

        // Map frontend status back to schema status
        let newStatus = 'PENDING_APPROVAL';
        if (status === 'confirmed' || status === 'active') newStatus = 'ACCEPTED';
        if (status === 'rejected' || status === 'cancelled') newStatus = 'REJECTED';

        // Update the specific service for this seller
        const serviceIndex = booking.services.findIndex(s => s.seller?.toString() === sellerId?.toString());
        if (serviceIndex !== -1) {
            booking.services[serviceIndex].status = newStatus;
            await booking.save();
        }

        return handleResponse(res, 200, 'Reservation status updated successfully', { _id: booking._id, status });
    } catch (error) {
        console.error('Error updating reservation status:', error);
        return handleResponse(res, 500, 'Failed to update reservation status');
    }
};
