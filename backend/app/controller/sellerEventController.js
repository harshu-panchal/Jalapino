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
        if (status === 'completed') newStatus = 'COMPLETED';

        // Update ALL services for this seller in the booking
        let updatedAny = false;
        booking.services.forEach(s => {
            if (s.seller?.toString() === sellerId?.toString()) {
                s.status = newStatus;
                updatedAny = true;
            }
        });

        if (updatedAny) {
            // --- ORCHESTRATION ENGINE ---
            const allAccepted = booking.services.every(s => s.status === 'ACCEPTED');
            const anyRejected = booking.services.some(s => s.status === 'REJECTED');
            const allCompleted = booking.services.every(s => s.status === 'COMPLETED');

            if (anyRejected) {
                // If any seller rejects, notify customer so they can pick alternative
                try {
                    const { emitCustomerNotification } = await import('../modules/notifications/notification.service.js');
                    emitCustomerNotification('EVENT_BOOKING_REJECTED', {
                        userId: booking.customer,
                        bookingId: booking._id,
                        message: `One of your requested providers has rejected the booking. Please select an alternative.`
                    });
                } catch (e) { console.log('Notification error', e) }
            } else if (allAccepted && booking.overallStatus !== 'COMPLETED') {
                // ALL SELLERS APPROVED! PAYMENT ENABLED.
                booking.overallStatus = 'PAYMENT_PENDING';
                try {
                    const { emitCustomerNotification } = await import('../modules/notifications/notification.service.js');
                    emitCustomerNotification('EVENT_BOOKING_APPROVED', {
                        userId: booking.customer,
                        bookingId: booking._id,
                        message: `All providers have approved your booking! You can now proceed to payment.`
                    });
                } catch (e) { console.log('Notification error', e) }
            } else if (newStatus === 'COMPLETED') {
                booking.overallStatus = 'COMPLETED';

                // --- GENERATE PAYOUT ---
                try {
                    const Setting = await import('../models/setting.js').then(m => m.default);
                    const EventPayout = await import('../models/event/EventPayout.js').then(m => m.default);
                    const Seller = await import('../models/seller.js').then(m => m.default);

                    const globalSettings = await Setting.findOne({});
                    const globalEventFee = globalSettings?.eventPlatformFee ?? 10;

                    for (const service of booking.services) {
                        if (service.status === 'COMPLETED' || service.status === 'ACCEPTED' || service.status === 'CONFIRMED') {
                            const seller = await Seller.findById(service.seller);
                            const commissionRate = seller?.commissionRate || globalEventFee;

                            const validServicesCount = booking.services.filter(s => ['COMPLETED', 'ACCEPTED', 'CONFIRMED'].includes(s.status)).length;
                            const serviceAmount = booking.totalAmount / (validServicesCount || 1);

                            const commissionDeducted = (serviceAmount * commissionRate) / 100;
                            const netPayoutAmount = serviceAmount - commissionDeducted;

                            const existingPayout = await EventPayout.findOne({ bookingId: booking._id, sellerId: service.seller });
                            if (!existingPayout) {
                                await EventPayout.create({
                                    sellerId: service.seller,
                                    bookingId: booking._id,
                                    totalAmount: serviceAmount,
                                    commissionRate: commissionRate,
                                    commissionDeducted: commissionDeducted,
                                    netPayoutAmount: netPayoutAmount,
                                    paymentMode: booking.paymentMode || 'COD',
                                    status: 'PENDING'
                                });
                            }
                        }
                    }
                } catch (payoutErr) {
                    console.error("Payout generation error:", payoutErr);
                }
            }

            await booking.save();
        }

        // --- RELIABILITY ENGINE ---
        try {
            if (newStatus === 'ACCEPTED' || newStatus === 'REJECTED') {
                const sellerDoc = await import('../models/seller.js').then(m => m.default.findById(sellerId));
                if (sellerDoc) {
                    const responseTimeMins = Math.round((Date.now() - booking.createdAt.getTime()) / 60000);
                    const newTotal = (sellerDoc.totalRequests || 0) + 1;

                    let newAccepted = sellerDoc.acceptedRequests || 0;
                    let newRejected = sellerDoc.rejectedRequests || 0;
                    let newAvgResponse = sellerDoc.avgResponseTimeMins || 0;

                    if (newStatus === 'ACCEPTED') {
                        newAccepted++;
                        newAvgResponse = Math.round(((sellerDoc.avgResponseTimeMins || 0) * (newTotal - 1) + responseTimeMins) / newTotal);
                    } else if (newStatus === 'REJECTED') {
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
            }
        } catch (e) {
            console.error("Reliability Engine error:", e);
        }
        // --------------------------

        return handleResponse(res, 200, 'Reservation status updated successfully', { _id: booking._id, status });
    } catch (error) {
        console.error('Error updating reservation status:', error);
        return handleResponse(res, 500, 'Failed to update reservation status');
    }
};
