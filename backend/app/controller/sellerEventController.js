import EventBooking from '../models/event/EventBooking.js';
import GeneralBooking from '../models/event/GeneralBooking.js';
import MemberTicket from '../models/event/MemberTicket.js';
import handleResponse from '../utils/helper.js';
import { getEventEndIST, getEventStartIST, formatIST, isEventBookingCalendarLocked } from '../utils/advanceBooking.js';

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
                // Accepted but customer not paid yet -> still a request (same as Reservations screen).
                if (sellerService.status === 'ACCEPTED') mappedStatus = isEventBookingCalendarLocked(booking) ? 'confirmed' : 'pending';
                if (sellerService.status === 'REJECTED') mappedStatus = 'rejected';
                if (sellerService.status === 'COMPLETED') mappedStatus = 'completed';
            }

            return {
                _id: booking._id,
                type: 'event',
                customerInfo: {
                    name: booking.customer?.name || "Customer",
                },
                status: mappedStatus,
                eventDate: booking.eventDate,
                // Guests only if the customer actually filled them (default 1 is not real data)
                guestCount: booking.eventInfo?.noOfGuests ? booking.guestCount : null,
                createdAt: booking.createdAt
            };
        });

        // ---- Ticket bookings (GeneralBooking) from DB ----
        // Abandoned online checkouts (Pending, never paid) are not real bookings.
        const ticketQuery = {
            sellerId,
            $nor: [{ paymentMethod: 'Razorpay', bookingStatus: 'Pending' }],
        };
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const [ticketTotal, ticketPending, ticketUpcoming, recentTicketsRaw] = await Promise.all([
            GeneralBooking.countDocuments(ticketQuery),
            GeneralBooking.countDocuments({ ...ticketQuery, bookingStatus: 'Pending' }),
            GeneralBooking.countDocuments({ ...ticketQuery, bookingStatus: 'Confirmed', bookingDate: { $gte: startOfToday } }),
            GeneralBooking.find(ticketQuery)
                .sort({ createdAt: -1 })
                .limit(5)
                .populate('customerId', 'name phone')
                .populate('venueId', 'name')
                .lean(),
        ]);
        const ticketIdsByBooking = new Map();
        if (recentTicketsRaw.length > 0) {
            const memberTickets = await MemberTicket.find({ bookingId: { $in: recentTicketsRaw.map(t => t._id) } })
                .select('bookingId ticketId')
                .lean();
            memberTickets.forEach(mt => {
                const key = String(mt.bookingId);
                ticketIdsByBooking.set(key, [...(ticketIdsByBooking.get(key) || []), mt.ticketId].filter(Boolean));
            });
        }
        const recentTickets = recentTicketsRaw.map(t => ({
            _id: t._id,
            type: 'ticket',
            customerInfo: { name: t.customerId?.name || 'Customer', phone: t.customerId?.phone || '' },
            status: String(t.bookingStatus || 'Pending').toLowerCase(),
            eventDate: t.bookingDate,
            guestCount: t.totalMembers,
            timeSlot: t.timeSlot,
            venueName: t.venueId?.name || 'Ticket',
            bookingType: t.bookingType,
            totalAmount: t.totalAmount,
            paymentMethod: t.paymentMethod,
            paymentStatus: t.paymentStatus,
            ticketIds: ticketIdsByBooking.get(String(t._id)) || [],
            createdAt: t.createdAt
        }));

        // Events + tickets together, newest first.
        const combinedRecent = [...recentRequests, ...recentTickets]
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 6);

        const stats = {
            totalReservations: totalReservations + ticketTotal,
            pendingRequests: pendingRequests + ticketPending,
            upcomingEvents: upcomingEvents + ticketUpcoming,
            recentRequests: combinedRecent
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
                if (sellerService.status === 'COMPLETED') mappedStatus = 'completed';
            }

            // Convert preferences array to object for the frontend modal
            const customerPreferences = {};
            if (sellerService && sellerService.preferences) {
                sellerService.preferences.forEach(pref => {
                    customerPreferences[pref.fieldName] = pref.value;
                });
            }

            const eventInfo = booking.eventInfo || {};
            const contactName = eventInfo.primaryContactName || eventInfo.name || (eventInfo.bookingType === 'corporate' ? (eventInfo.corporateCompanyName || eventInfo.corporateContactPerson) : eventInfo.coupleNames) || booking.customer?.name || "Customer";
            const contactPhone = eventInfo.primaryPhone || eventInfo.corporateMobile || booking.customer?.phone || "";

            const totalAmount = booking.totalAmount || (sellerService ? sellerService.amount : 0);
            const advancePercentage = (booking.advancePaymentPercentage && booking.advancePaymentPercentage > 0) ? booking.advancePaymentPercentage : 30;
            const advanceAmount = (booking.advancePaymentAmount !== undefined && booking.advancePaymentAmount !== null && Number(booking.advancePaymentAmount) > 0)
                ? booking.advancePaymentAmount
                : Math.round((Number(totalAmount || 0) * advancePercentage) / 100);

            return {
                _id: booking._id,
                bookingId: booking.bookingId,
                eventType: booking.eventType,
                customerInfo: {
                    name: contactName,
                    phone: contactPhone,
                    email: booking.customer?.email || ""
                },
                status: mappedStatus,
                eventDate: booking.eventDate,
                eventTime: booking.eventTime,
                remarks: booking.remarks,
                // Guests only if the customer actually filled them (default 1 is not real data)
                guestCount: booking.eventInfo?.noOfGuests ? booking.guestCount : null,
                location: booking.location,
                eventInfo: booking.eventInfo || {},
                selectedProducts: booking.selectedProducts || [],
                advancePaymentAmount: advanceAmount,
                advancePaymentPercentage: advancePercentage,
                paymentStatus: booking.paymentStatus || 'PENDING',
                paymentMode: booking.paymentMode || 'COD',
                // Money already received (verified online + COD cash) so the seller
                // sees the correct COD amount to collect.
                amountPaid: Number(booking.amountPaid) || 0,
                codAmountCollected: Number(booking.codAmountCollected) || 0,
                overallStatus: booking.overallStatus || 'PENDING',
                // Why the booking was closed automatically (another customer paid for the slot).
                closedReason: sellerService?.sellerNotes === 'Slot booked by another customer (payment done).' ? sellerService.sellerNotes : '',
                multipleEvents: booking.multipleEvents || [],
                customerPreferences: customerPreferences,
                sellerRating: booking.sellerRating || sellerService?.rating || 0,
                sellerReview: booking.sellerReview || sellerService?.review || '',
                sellerReviewedAt: booking.sellerReviewedAt || null,
                createdAt: booking.createdAt,
                amount: totalAmount,
                totalAmount: totalAmount
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

        // Service can be marked completed only after the booked slot's start date & time.
        if (status === 'completed') {
            // Only a CONFIRMED (paid) booking can be completed.
            if (!isEventBookingCalendarLocked(booking)) {
                return handleResponse(res, 400, 'This booking can be marked as completed only after the customer has made the payment.');
            }
            const eventStart = getEventStartIST(booking);
            if (eventStart && Date.now() < eventStart.getTime()) {
                return handleResponse(res, 400, `You can mark this booking as completed only after the event starts (${formatIST(eventStart)}).`);
            }
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
                booking.overallStatus = allCompleted ? 'COMPLETED' : 'IN_PROGRESS';
                if (allCompleted && !booking.completedAt) {
                    booking.completedAt = new Date();
                }

                if (allCompleted && booking.paymentStatus === 'ADVANCE_PAID') {
                    try {
                        const Setting = await import('../models/setting.js').then(m => m.default);
                        const globalSettings = await Setting.findOne({}).lean();
                        const advancePercent = globalSettings?.bookingControl?.advanceBookingLimitPercent ?? 20;
                        const advancePaid = Math.round((Number(booking.totalAmount || 0) * advancePercent) / 100);
                        const remainingAmount = Math.max(0, Number(booking.totalAmount || 0) - advancePaid);

                        if (remainingAmount > 0) {
                            const { emitCustomerNotification } = await import('../modules/notifications/notification.service.js');
                            const { NOTIFICATION_EVENTS } = await import('../modules/notifications/notification.constants.js');
                            emitCustomerNotification(NOTIFICATION_EVENTS.EVENT_BOOKING_REMAINING_PAYMENT_DUE, {
                                userId: booking.customer,
                                bookingId: booking._id,
                                message: `Your event service has started / been delivered by the seller. Please pay the remaining balance of ₹${remainingAmount}.`,
                                data: { remainingAmount },
                            });
                        }
                    } catch (notificationError) {
                        console.error('Remaining payment notification error:', notificationError);
                    }
                }

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

// Confirm COD payment by seller
export const confirmCODPayment = async (req, res) => {
    try {
        const sellerId = req.user.sellerId || req.user.id;
        const { id } = req.params;

        const booking = await EventBooking.findOne({ _id: id, "services.seller": sellerId });
        if (!booking) {
            return handleResponse(res, 404, 'Reservation not found');
        }

        if (booking.overallStatus === 'CANCELLED') {
            return handleResponse(res, 400, 'Booking is cancelled');
        }
        const { isEventBookingCalendarLocked } = await import('../utils/advanceBooking.js');
        const wasLockedBeforeCash = isEventBookingCalendarLocked(booking);
        // Record the cash the seller collected (the unpaid balance), once.
        // Any online (Razorpay) part is already in amountPaid.
        const total = Number(booking.totalAmount) || 0;
        // part = 'advance': seller got only the ADVANCE in cash (same advance as online).
        // Otherwise: the whole unpaid balance in cash (as before).
        const alreadyPaid = Number(booking.amountPaid) || 0;
        const advancePct = Number(booking.advancePaymentPercentage) > 0 ? Number(booking.advancePaymentPercentage) : 30;
        const advanceAmount = Number(booking.advancePaymentAmount) > 0
            ? Number(booking.advancePaymentAmount)
            : Math.round((total * advancePct) / 100);
        const isAdvance = String(req.body?.part || '').toLowerCase() === 'advance'
            && alreadyPaid <= 0 && advanceAmount > 0 && advanceAmount < total;
        const codPart = isAdvance
            ? Math.round(advanceAmount * 100) / 100
            : Math.round(Math.max(0, total - alreadyPaid) * 100) / 100;
        if (codPart > 0) {
            booking.amountPaid = Math.round(((Number(booking.amountPaid) || 0) + codPart) * 100) / 100;
            booking.codAmountCollected = Math.round(((Number(booking.codAmountCollected) || 0) + codPart) * 100) / 100;
        }
        if (!booking.refundBaseEventDate) {
            booking.refundBaseEventDate = booking.eventDate;
            booking.refundBaseEventTime = booking.eventTime;
        }
        const wasAlreadyPaid = booking.paymentStatus === 'PAID';
        booking.paymentStatus = isAdvance ? 'ADVANCE_PAID' : 'PAID';
        if (booking.overallStatus === 'PENDING' || booking.overallStatus === 'PAYMENT_PENDING') {
            booking.overallStatus = 'CONFIRMED';
        }
        await booking.save();
        // Booking just got paid -> close other unpaid bookings that no longer fit this slot.
        if (!wasLockedBeforeCash) {
            const { closeConflictingUnpaidBookings } = await import('./eventBookingController.js');
            await closeConflictingUnpaidBookings(booking);
        }

        // Payment done (cash) -> customer gets a notification (no ringtone). Sent once.
        if (!wasAlreadyPaid && codPart > 0) {
            try {
                const { emitCustomerNotification } = await import('../modules/notifications/notification.service.js');
                emitCustomerNotification('EVENT_BOOKING_PAYMENT_CONFIRMED', {
                    userId: booking.customer,
                    bookingId: booking._id,
                    message: isAdvance
                        ? `Advance cash payment of ₹${codPart.toLocaleString('en-IN')} for booking ${booking.bookingId} has been received by the seller. Balance due: ₹${Math.max(0, total - codPart).toLocaleString('en-IN')} (cash).`
                        : `Cash payment of ₹${codPart.toLocaleString('en-IN')} for booking ${booking.bookingId} has been received by the seller.`
                });
            } catch (notifyError) {
                console.error('COD payment notification error:', notifyError);
            }
        }

        return handleResponse(res, 200, 'COD payment confirmed successfully', {
            _id: booking._id,
            paymentStatus: booking.paymentStatus,
            overallStatus: booking.overallStatus,
            amountPaid: Number(booking.amountPaid) || 0,
            codAmountCollected: Number(booking.codAmountCollected) || 0
        });
    } catch (error) {
        console.error('Error confirming COD payment:', error);
        return handleResponse(res, 500, 'Failed to confirm COD payment');
    }
};
