import Razorpay from 'razorpay';
import Order from '../models/order.js';
import handleResponse from '../utils/helper.js';
import crypto from 'crypto';

export const createRazorpayEcommerceOrder = async (req, res) => {
    try {
        const orderId = req.params.id;
        const { amount } = req.body;

        const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });

        const options = {
            amount: Math.round(amount * 100),
            currency: 'INR',
            receipt: `e_${orderId.slice(-6)}_${Date.now()}`
        };

        const order = await razorpay.orders.create(options);
        return handleResponse(res, 200, 'Razorpay order created', order);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

export const verifyRazorpayEcommerceOrder = async (req, res) => {
    try {
        const orderId = req.params.id;
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        const body = razorpay_order_id + '|' + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest('hex');

        if (expectedSignature === razorpay_signature) {
            // Fetch Razorpay order to get the actual amount paid
            const razorpay = new Razorpay({
                key_id: process.env.RAZORPAY_KEY_ID,
                key_secret: process.env.RAZORPAY_KEY_SECRET,
            });
            const rzpOrder = await razorpay.orders.fetch(razorpay_order_id);
            const amountPaidInRupees = rzpOrder.amount / 100;

            // Mark order as paid
            const orders = await Order.find({
                $or: [
                    { orderId: orderId },
                    { checkoutGroupId: orderId }
                ]
            });

            if (orders && orders.length > 0) {
                for (let o of orders) {
                    const advanceRequired = o.paymentBreakdown?.advanceAmountRequired || 0;
                    const grandTotal = o.paymentBreakdown?.payableAmount || o.paymentBreakdown?.grandTotal || 0;

                    // If amount paid is less than grand total but >= advance required, it's an advance payment
                    if (advanceRequired > 0 && amountPaidInRupees < grandTotal) {
                        if (o.paymentBreakdown) {
                            o.paymentBreakdown.isAdvancePaid = true;
                        }
                        o.paymentStatus = 'PENDING_CASH_COLLECTION';
                        o.paymentMode = 'COD';
                    } else {
                        // Full payment
                        o.paymentStatus = 'PAID';
                        o.paymentMode = 'ONLINE';
                    }
                    await o.save();
                }
            }
            return handleResponse(res, 200, 'Payment verified successfully');
        } else {
            return handleResponse(res, 400, 'Invalid signature');
        }
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};
