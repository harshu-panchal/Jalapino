import EventPayout from '../models/event/EventPayout.js';
import handleResponse from '../utils/helper.js';

// Get all pending payouts for admin
export const getAdminPayouts = async (req, res) => {
    try {
        if (req.user.role !== 'admin') return handleResponse(res, 403, 'Unauthorized');

        const payouts = await EventPayout.find()
            .populate('sellerId', 'name shopName email phone')
            .populate({
                path: 'bookingId',
                select: 'bookingId eventDate eventType customer',
                populate: { path: 'customer', select: 'name phone' }
            })
            .sort({ createdAt: -1 });
            
        return handleResponse(res, 200, 'Payouts fetched successfully', payouts);
    } catch (error) {
        console.error("Fetch payouts error:", error);
        return handleResponse(res, 500, 'Failed to fetch payouts');
    }
};

// Settle a payout
export const settlePayout = async (req, res) => {
    try {
        if (req.user.role !== 'admin') return handleResponse(res, 403, 'Unauthorized');

        const { transactionReference } = req.body;
        const payout = await EventPayout.findById(req.params.id);
        
        if (!payout) return handleResponse(res, 404, 'Payout not found');
        if (payout.status === 'PAID') return handleResponse(res, 400, 'Payout already settled');

        payout.status = 'PAID';
        payout.settledAt = new Date();
        if (transactionReference) payout.transactionReference = transactionReference;

        await payout.save();
        
        return handleResponse(res, 200, 'Payout marked as SETTLED', payout);
    } catch (error) {
        console.error("Settle payout error:", error);
        return handleResponse(res, 500, 'Failed to settle payout');
    }
};
