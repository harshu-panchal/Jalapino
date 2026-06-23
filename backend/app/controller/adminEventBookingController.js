import EventBooking from '../models/event/EventBooking.js';
import handleResponse from '../utils/helper.js';

export const getAllEventBookings = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const totalBookings = await EventBooking.countDocuments();

        const bookings = await EventBooking.find()
            .populate('customer', 'name email phone')
            .populate('services.seller', 'name shopName')
            .populate('services.category', 'name categoryName')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        // Format for admin consumption
        const formattedBookings = bookings.map(booking => ({
            _id: booking._id,
            bookingId: booking.bookingId,
            customer: booking.customer ? {
                name: booking.customer.name,
                phone: booking.customer.phone,
                email: booking.customer.email
            } : { name: 'Unknown Customer' },
            eventType: booking.eventType,
            eventDate: booking.eventDate,
            eventTime: booking.eventTime,
            guestCount: booking.guestCount,
            budget: booking.budget,
            location: booking.location,
            paymentStatus: booking.paymentStatus,
            paymentMode: booking.paymentMode,
            overallStatus: booking.overallStatus,
            totalAmount: booking.totalAmount,
            createdAt: booking.createdAt,
            services: booking.services.map(s => {
                let catName = 'Unknown Category (NULL in DB)';
                if (s.category) {
                    if (typeof s.category === 'object' && (s.category.name || s.category.categoryName)) {
                        catName = s.category.name || s.category.categoryName;
                    } else {
                        catName = `Category ID: ${s.category.toString()}`;
                    }
                }
                return {
                    sellerName: s.seller ? (s.seller.shopName || s.seller.name) : 'Pending Assign',
                    categoryName: catName,
                    status: s.status
                };
            })
        }));

        return handleResponse(res, 200, 'All event bookings fetched successfully', {
            bookings: formattedBookings,
            pagination: {
                total: totalBookings,
                page,
                limit,
                totalPages: Math.ceil(totalBookings / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching event bookings:', error);
        return handleResponse(res, 500, 'Failed to fetch event bookings');
    }
};

export const deleteAdminEventBooking = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedBooking = await EventBooking.findByIdAndDelete(id);
        
        if (!deletedBooking) {
            return handleResponse(res, 404, 'Booking not found');
        }
        
        return handleResponse(res, 200, 'Event booking deleted successfully');
    } catch (error) {
        console.error('Error deleting event booking:', error);
        return handleResponse(res, 500, 'Failed to delete event booking');
    }
};
