import Razorpay from 'razorpay';
import Order from '../models/order.js';
import CheckoutGroup from '../models/checkoutGroup.js';
import EventBooking from '../models/event/EventBooking.js';
import mongoose from 'mongoose';
import handleResponse from '../utils/helper.js';
import crypto from 'crypto';
import { ORDER_PAYMENT_STATUS, isWalletRedemptionReducesPayableEnabled } from '../constants/finance.js';
import { WORKFLOW_STATUS, DEFAULT_SELLER_TIMEOUT_MS } from '../constants/orderWorkflow.js';
import { afterPlaceOrderV2 } from '../services/orderWorkflowService.js';
import { handleOnlineOrderFinance } from '../services/finance/orderFinanceService.js';
import { emitNotificationEvent } from '../modules/notifications/notification.emitter.js';
import { NOTIFICATION_EVENTS } from '../modules/notifications/notification.constants.js';

// Real-app style online payment:
// - the amount is worked out on the server from the saved order (never trusted from the app)
// - the order goes to the seller ONLY after Razorpay confirms the payment
// - unpaid orders stay hidden from the seller and auto-cancel after the stock-hold window
// - if a payment lands after the order already expired, it is refunded automatically

const round2 = (v) => Math.round(Number(v || 0) * 100) / 100;
const getRazorpay = () => new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const findOrdersForRef = (ref) => Order.find({ $or: [{ orderId: ref }, { checkoutGroupId: ref }] })
    .sort({ checkoutGroupIndex: 1, createdAt: 1 });

const isCancelled = (o) => o.status === 'cancelled' || o.workflowStatus === WORKFLOW_STATUS.CANCELLED;
const isAlreadyPaid = (o) => o.paymentStatus === ORDER_PAYMENT_STATUS.PAID || Boolean(o.paymentBreakdown?.isAdvancePaid);

// Same amount the customer saw on checkout: advance (if the seller asks for one) or the
// full total, minus the wallet part already used.
export function computeOnlinePayableAmount(orders) {
    const walletReducesTotal = isWalletRedemptionReducesPayableEnabled();
    return round2(orders.reduce((sum, o) => {
        const pb = o.paymentBreakdown || {};
        const wallet = Number(o.pricing?.walletAmount ?? pb.walletAmount ?? 0);
        const fullBeforeWallet = Number(pb.grandTotal ?? o.pricing?.total ?? 0) + (walletReducesTotal ? Number(pb.walletAmount || 0) : 0);
        const advance = Number(pb.advanceAmountRequired || 0);
        const base = advance > 0 ? advance : fullBeforeWallet;
        return sum + Math.max(0, base - wallet);
    }, 0));
}

function checkOrdersPayable(orders, userId) {
    if (!orders.length) return [404, 'Order not found'];
    for (const o of orders) {
        if (String(o.customer) !== String(userId)) return [403, 'You are not allowed to pay for this order'];
        if (o.paymentMode !== 'ONLINE' && !o.paymentBreakdown?.isAdvancePaid) return [400, 'Payment is allowed only for online orders'];
    }
    return null;
}

export const createRazorpayEcommerceOrder = async (req, res) => {
    try {
        const orderId = req.params.id;
        const userId = req.user?.id || req.user?._id;
        const orders = await findOrdersForRef(orderId);

        // Plan My Event booking (same endpoint is used for its advance / remaining payment).
        if (!orders.length && mongoose.Types.ObjectId.isValid(String(orderId))) {
            const booking = await EventBooking.findById(orderId);
            if (booking) {
                if (String(booking.customer) !== String(userId)) return handleResponse(res, 403, 'You are not allowed to pay for this booking');
                if (['CANCELLED', 'COMPLETED'].includes(booking.overallStatus)) return handleResponse(res, 400, 'Booking can no longer be paid');
                const balance = round2(Number(booking.totalAmount || 0) - Number(booking.amountPaid || 0));
                if (!(balance > 0)) return handleResponse(res, 409, 'This booking is already paid.');
                const { checkEventBookingStillAvailable, EVENT_PAYMENT_HOLD_MS } = await import('./eventBookingController.js');
                const unavailable = await checkEventBookingStillAvailable(booking);
                if (unavailable) return handleResponse(res, 409, unavailable);
                // First payment: hold the slot for this customer while they pay.
                if (!(Number(booking.amountPaid) > 0)) {
                    booking.paymentHoldUntil = new Date(Date.now() + EVENT_PAYMENT_HOLD_MS);
                    await booking.save();
                }
                const requested = round2(req.body?.amount);
                const amount = requested > 0 ? Math.min(requested, balance) : balance;
                const rzpOrder = await getRazorpay().orders.create({
                    amount: Math.round(amount * 100),
                    currency: 'INR',
                    receipt: `e_${String(booking._id).slice(-6)}_${Date.now()}`,
                    notes: { eventBookingId: String(booking._id) },
                });
                return handleResponse(res, 200, 'Razorpay order created', rzpOrder);
            }
        }

        const problem = checkOrdersPayable(orders, userId);
        if (problem) return handleResponse(res, problem[0], problem[1]);
        if (orders.some(isCancelled)) return handleResponse(res, 409, 'This order has expired. Please place a new order.');
        if (orders.every(isAlreadyPaid)) return handleResponse(res, 409, 'This order is already paid.');

        const amount = computeOnlinePayableAmount(orders);
        if (!(amount > 0)) return handleResponse(res, 400, 'Nothing to pay for this order.');

        const order = await getRazorpay().orders.create({
            amount: Math.round(amount * 100),
            currency: 'INR',
            receipt: `e_${String(orderId).slice(-6)}_${Date.now()}`,
            notes: { orderRef: String(orderId) },
        });
        return handleResponse(res, 200, 'Razorpay order created', order);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

async function moveToSellerAfterPayment(order) {
    const until = new Date(Date.now() + DEFAULT_SELLER_TIMEOUT_MS());
    const updated = await Order.findOneAndUpdate(
        { _id: order._id, workflowVersion: { $gte: 2 }, workflowStatus: WORKFLOW_STATUS.CREATED },
        { $set: { workflowStatus: WORKFLOW_STATUS.SELLER_PENDING, sellerPendingExpiresAt: until, expiresAt: until } },
        { new: true },
    );
    if (updated) {
        void afterPlaceOrderV2(updated).catch((err) => console.warn('afterPlaceOrderV2 failed', updated.orderId, err.message));
    }
}

export const verifyRazorpayEcommerceOrder = async (req, res) => {
    try {
        const orderId = req.params.id;
        const userId = req.user?.id || req.user?._id;
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return handleResponse(res, 400, 'Payment details are missing');
        }

        // 1. Signature from Razorpay
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');
        if (expectedSignature !== razorpay_signature) {
            return handleResponse(res, 400, 'Invalid signature');
        }

        const orders = await findOrdersForRef(orderId);
        const problem = checkOrdersPayable(orders, userId);
        if (problem) return handleResponse(res, problem[0], problem[1]);
        // Same payment sent twice -> already done.
        if (orders.every(isAlreadyPaid)) return handleResponse(res, 200, 'Payment verified successfully');

        // 2. Confirm with Razorpay: this payment really happened, for THIS order, for the full amount.
        const razorpay = getRazorpay();
        const [rzpOrder, rzpPayment] = await Promise.all([
            razorpay.orders.fetch(razorpay_order_id),
            razorpay.payments.fetch(razorpay_payment_id),
        ]);
        if (String(rzpOrder?.notes?.orderRef || '') !== String(orderId) || rzpPayment?.order_id !== razorpay_order_id) {
            return handleResponse(res, 400, 'This payment does not belong to this order');
        }
        if (rzpPayment.status !== 'captured') {
            return handleResponse(res, 400, 'Payment is not completed yet');
        }
        const amountPaid = round2(Number(rzpPayment.amount) / 100);
        const expected = computeOnlinePayableAmount(orders);
        if (Math.abs(amountPaid - expected) > 0.01) {
            return handleResponse(res, 400, `Paid amount (₹${amountPaid}) does not match the amount due (₹${expected})`);
        }

        // 3. Order expired (payment timeout) before the money arrived -> refund, don't confirm.
        if (orders.some(isCancelled)) {
            try {
                await razorpay.payments.refund(razorpay_payment_id, { amount: Number(rzpPayment.amount), notes: { orderRef: String(orderId), reason: 'Order expired before payment' } });
            } catch (refundError) {
                console.error('Auto refund failed:', refundError?.error?.description || refundError?.message);
            }
            return handleResponse(res, 409, 'This order had expired, so your payment will be refunded to your original payment method.');
        }

        // 4. Mark paid, then send to the seller (only now).
        for (const o of orders) {
            const advance = Number(o.paymentBreakdown?.advanceAmountRequired || 0);
            const isFull = !(advance > 0);
            if (isFull) {
                o.paymentStatus = ORDER_PAYMENT_STATUS.PAID;
                o.paymentMode = 'ONLINE';
            } else {
                if (o.paymentBreakdown) o.paymentBreakdown.isAdvancePaid = true;
                o.paymentStatus = ORDER_PAYMENT_STATUS.PENDING_CASH_COLLECTION;
                o.paymentMode = 'COD';
            }
            if (o.payment) {
                // Full online payment is complete; for advance the rest is still due on delivery.
                o.payment.status = isFull ? 'completed' : 'pending';
                o.payment.transactionId = razorpay_payment_id;
            }
            await o.save();

            if (isFull) {
                await handleOnlineOrderFinance(o._id, {
                    transactionId: razorpay_payment_id,
                    metadata: { razorpayOrderId: razorpay_order_id, checkoutGroupId: o.checkoutGroupId || null },
                }).catch((err) => console.error('Online finance entry failed:', o.orderId, err.message));
            }
            await moveToSellerAfterPayment(o);

            emitNotificationEvent(NOTIFICATION_EVENTS.PAYMENT_SUCCESS, {
                orderId: o.orderId, checkoutGroupId: o.checkoutGroupId, customerId: o.customer, userId: o.customer, sellerId: o.seller,
            });
            if (o.seller) {
                emitNotificationEvent(NOTIFICATION_EVENTS.NEW_ORDER, {
                    orderId: o.orderId, checkoutGroupId: o.checkoutGroupId, sellerId: o.seller, customerId: o.customer,
                });
            }
        }
        const groupId = orders[0]?.checkoutGroupId;
        if (groupId) {
            await CheckoutGroup.updateOne(
                { checkoutGroupId: groupId },
                { $set: { status: 'PAID', paymentStatus: ORDER_PAYMENT_STATUS.PAID, 'stockReservation.status': 'COMMITTED' } },
            ).catch(() => {});
        }

        return handleResponse(res, 200, 'Payment verified successfully');
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};
