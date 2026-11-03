import EventBooking from '../models/event/EventBooking.js';
import Product from '../models/product.js';
import handleResponse from '../utils/helper.js';
import { emitCustomerNotification } from '../modules/notifications/notification.service.js';

// Get all event requests for the logged-in seller
export const getEventRequests = async (req, res) => {
    try {
        const sellerId = req.user.sellerId || req.user.id || req.user._id;

        // Find all bookings where this seller is part of the services array
        const bookings = await EventBooking.find({
            'services.seller': sellerId
        })
            .populate('customer', 'name email phone')
            .populate('selectedProducts.productId', 'name')
            .sort({ createdAt: -1 });

        const productIds = new Set();
        const addProductId = value => {
            const rawId = value && typeof value === 'object'
                ? (value._id || value.productId || value.id || value.toHexString?.())
                : value;
            const id = String(rawId || '');
            if (/^[a-f\d]{24}$/i.test(id)) productIds.add(id);
        };
        bookings.forEach(booking => {
            (booking.selectedProducts || []).forEach(line => addProductId(line.productId));
            const service = booking.services.find(item => item.seller && item.seller.toString() === sellerId.toString());
            (service?.preferences || []).forEach(preference => {
                if (preference.fieldName === 'selectedProducts' && Array.isArray(preference.value)) {
                    preference.value.forEach(addProductId);
                }
                if (preference.fieldName === 'selectedProductQuantities' && Array.isArray(preference.value)) {
                    preference.value.forEach(line => addProductId(line?.productId || line?._id));
                }
            });
        });
        const productDocs = productIds.size
            ? await Product.find({ _id: { $in: [...productIds] } }).select('_id name').lean()
            : [];
        const productNamesById = Object.fromEntries(productDocs.map(product => [String(product._id), product.name]));

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
                remarks: booking.remarks,
                guestCount: booking.guestCount,
                location: booking.location,
                overallStatus: booking.overallStatus,
                paymentStatus: booking.paymentStatus || 'PENDING',
                myServiceStatus: myService ? myService.status : 'UNKNOWN',
                serviceDetails: myService,
                eventInfo: booking.eventInfo,
                selectedShop: booking.selectedShop || null,
                selectedProducts: booking.selectedProducts || [],
                productNamesById,
                totalAmount: booking.totalAmount,
                advancePaymentAmount: booking.advancePaymentAmount,
                advancePaymentPercentage: booking.advancePaymentPercentage,
                multipleEvents: booking.multipleEvents || []
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
        const sellerId = req.user.sellerId || req.user.id || req.user._id;
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

        const myService = booking.services.find(s => s.seller && s.seller.toString() === sellerId.toString());
        if (status === 'ACCEPTED' && myService?.quotePermissions?.sellerQuotation && myService.quotation?.status !== 'APPROVED') {
            return handleResponse(res, 400, 'Send a quotation and wait for customer approval before accepting this request');
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

export const sendEventQuotation = async (req, res) => {
    try {
        const sellerId = req.user.sellerId || req.user.id || req.user._id;
        const { amount, note = '' } = req.body;
        const price = Number(amount);
        if (!Number.isFinite(price) || price < 0) return handleResponse(res, 400, 'Enter a valid quotation amount');
        const booking = await EventBooking.findById(req.params.id);
        if (!booking) return handleResponse(res, 404, 'Booking not found');
        const service = booking.services.find(s => String(s.seller) === String(sellerId));
        if (!service) return handleResponse(res, 403, 'You are not assigned to this booking');
        if (!service.quotePermissions?.sellerQuotation) return handleResponse(res, 403, 'Quotation is not enabled for your seller account');
        if (service.status === 'ACCEPTED') return handleResponse(res, 400, 'Quotation cannot be changed after accepting the request');
        const isRevision = service.quotation?.status === 'REVISION_REQUESTED';
        if (isRevision && !service.quotePermissions.revision) return handleResponse(res, 403, 'Quotation revisions are not enabled');
        service.quotation = { ...service.quotation?.toObject?.(), amount: price, note: String(note).trim(), status: service.quotePermissions.customerApproval ? 'PENDING_CUSTOMER' : 'APPROVED', sentAt: new Date() };
        service.amount = price;
        booking.totalAmount = price;
        if (booking.advancePaymentPercentage > 0) booking.advancePaymentAmount = Math.round(price * booking.advancePaymentPercentage / 100);
        await booking.save();
        emitCustomerNotification('EVENT_QUOTATION_RECEIVED', { userId: booking.customer, bookingId: booking._id, message: 'Your seller sent an event quotation.' });
        return handleResponse(res, 200, 'Quotation sent', booking);
    } catch (error) {
        console.error('Send event quotation error:', error);
        return handleResponse(res, 500, 'Failed to send quotation');
    }
};
