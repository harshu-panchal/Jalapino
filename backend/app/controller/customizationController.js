import crypto from 'crypto';
import Razorpay from 'razorpay';
import CustomizationRequest from '../models/event/CustomizationRequest.js';
import EventChatSession from '../models/event/EventChatSession.js';
import Seller from '../models/seller.js';
import handleResponse from '../utils/helper.js';
import { emitSellerNotification, emitCustomerNotification } from '../modules/notifications/notification.service.js';

// Customization & Quotation - separate from event bookings. Payment works the same
// way as bookings: advance (seller's advance %) or full online, or COD with cash
// recorded by the seller.

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const customerIdOf = (req) => String(req.user.id || req.user._id || '');
const sellerIdOf = (req) => String(req.user.sellerId || req.user.id || req.user._id || '');
const totalOf = (r) => Number(r?.quotation?.amount) || 0;
const advanceOf = (r) => {
    const total = totalOf(r);
    const pct = Number(r?.advancePaymentPercentage) || 0;
    return pct > 0 ? Math.round((total * pct) / 100) : total;
};
const balanceOf = (r) => Math.max(0, round2(totalOf(r) - (Number(r?.amountPaid) || 0)));
const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const notifySeller = (r, message) => {
    try {
        emitSellerNotification('EVENT_CUSTOMIZATION_UPDATE', { userId: r.seller, requestId: r._id, message });
    } catch (e) { console.error('Customization seller notification error:', e); }
};
const notifyCustomer = (r, message) => {
    try {
        emitCustomerNotification('EVENT_CUSTOMIZATION_CUSTOMER', { userId: r.customer, requestId: r._id, message });
    } catch (e) { console.error('Customization customer notification error:', e); }
};

// Post a message into the existing customer <-> seller chat (saved in DB, live via socket).
const postChatMessage = async ({ customerId, sellerId, sender, text, imageUrl }) => {
    let session = await EventChatSession.findOne({ customer: customerId, seller: sellerId, status: 'active' });
    if (!session) session = new EventChatSession({ customer: customerId, seller: sellerId, messages: [] });
    session.messages.push({ sender, text, imageUrl: imageUrl || undefined, isRead: false });
    session.lastMessageAt = new Date();
    await session.save();
    const saved = session.messages[session.messages.length - 1];
    try {
        const { getIO } = await import('../socket/socketManager.js');
        const room = `seller_chat_${sellerId}_${customerId}`;
        const payload = {
            sender, text, imageUrl: imageUrl || undefined, isRead: false,
            id: saved._id, room, sessionId: session._id,
            customerId: String(customerId), sellerId: String(sellerId),
            createdAt: saved.createdAt || session.lastMessageAt,
            time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }),
        };
        getIO().to(room).emit('chat_message', payload);
        if (sender === 'customer') getIO().to(`seller:${sellerId}`).emit('chat_inbox_update', payload);
    } catch (e) { /* socket not ready - message is saved, shows on refresh */ }
    return session;
};

/* ---------------- CUSTOMER ---------------- */

export const createCustomizationRequest = async (req, res) => {
    try {
        const customerId = customerIdOf(req);
        const { sellerId, details = {} } = req.body || {};
        if (!sellerId) return handleResponse(res, 400, 'sellerId is required');
        const seller = await Seller.findById(sellerId)
            .select('shopName name advancePaymentPercentage customizationEngineEnabled quoteThemeSelection quoteBudgetSelection quoteReferencePhotoUpload quoteColorCombination quoteCustomerNotes')
            .lean();
        if (!seller) return handleResponse(res, 404, 'Seller not found');
        if (!seller.customizationEngineEnabled) return handleResponse(res, 400, 'This seller is not taking customization requests');

        // Keep only the fields the admin enabled for this seller.
        const clean = {
            decorationType: seller.quoteThemeSelection ? String(details.decorationType || '').trim() : '',
            colors: seller.quoteColorCombination ? (Array.isArray(details.colors) ? details.colors : []).map(c => String(c).trim()).filter(Boolean).slice(0, 20) : [],
            theme: seller.quoteThemeSelection ? String(details.theme || '').trim() : '',
            budget: seller.quoteBudgetSelection && Number(details.budget) > 0 ? Number(details.budget) : undefined,
            // Uploaded image: full link (https://...) or the upload's own path (/images/...).
            referencePhotoUrl: seller.quoteReferencePhotoUpload && /^(https?:\/\/|\/(?!\/))\S+$/i.test(String(details.referencePhotoUrl || '').trim()) ? String(details.referencePhotoUrl).trim() : '',
            notes: seller.quoteCustomerNotes ? String(details.notes || '').trim() : '',
        };
        const hasAny = clean.decorationType || clean.colors.length || clean.theme || clean.budget || clean.referencePhotoUrl || clean.notes;
        if (!hasAny) return handleResponse(res, 400, 'Please fill at least one customization detail.');

        const request = new CustomizationRequest({
            requestId: `CUS-${Date.now()}${Math.floor(Math.random() * 90 + 10)}`,
            customer: customerId,
            seller: sellerId,
            details: clean,
            advancePaymentPercentage: Number(seller.advancePaymentPercentage) || 0,
        });

        const lines = [
            `Customization Request (${request.requestId})`,
            clean.decorationType ? `Decoration Type: ${clean.decorationType}` : '',
            clean.colors.length ? `Colors: ${clean.colors.join(', ')}` : '',
            clean.theme ? `Theme: ${clean.theme}` : '',
            clean.budget ? `Budget: ${money(clean.budget)}` : '',
            clean.notes ? `Notes: ${clean.notes}` : '',
        ].filter(Boolean);
        const session = await postChatMessage({
            customerId, sellerId, sender: 'customer', text: lines.join('\n'), imageUrl: clean.referencePhotoUrl,
        });
        request.chatSession = session._id;
        await request.save();

        try {
            emitSellerNotification('EVENT_CUSTOMIZATION_REQUEST', {
                userId: sellerId,
                requestId: request._id,
                message: `New customization request ${request.requestId}. Please send your quotation.`,
            });
        } catch (e) { console.error('Customization request notification error:', e); }

        return handleResponse(res, 201, 'Customization request sent to the seller', request);
    } catch (error) {
        console.error('createCustomizationRequest error:', error);
        return handleResponse(res, 500, 'Failed to send customization request');
    }
};

export const getMyCustomizationRequests = async (req, res) => {
    try {
        const items = await CustomizationRequest.find({ customer: customerIdOf(req) })
            .populate('seller', 'shopName name')
            .sort({ createdAt: -1 })
            .lean();
        return handleResponse(res, 200, 'Customization requests fetched', items);
    } catch (error) {
        return handleResponse(res, 500, 'Failed to fetch customization requests');
    }
};

const loadForCustomer = async (req, res) => {
    const request = await CustomizationRequest.findById(req.params.id);
    if (!request) { handleResponse(res, 404, 'Customization request not found'); return null; }
    if (String(request.customer) !== customerIdOf(req)) { handleResponse(res, 403, 'Unauthorized'); return null; }
    return request;
};

export const respondToCustomizationQuotation = async (req, res) => {
    try {
        const request = await loadForCustomer(req, res);
        if (!request) return;
        const { action, note = '' } = req.body || {};
        if (request.status !== 'QUOTED') return handleResponse(res, 400, 'There is no quotation awaiting your response');
        if (action === 'APPROVE') {
            request.status = 'APPROVED';
            request.quotation.approvedAt = new Date();
            await request.save();
            notifySeller(request, `Customer approved your quotation ${money(totalOf(request))} for ${request.requestId}.`);
        } else if (action === 'REQUEST_REVISION') {
            request.status = 'REVISION_REQUESTED';
            request.quotation.revisionNote = String(note).trim();
            request.quotation.revisionRequestedAt = new Date();
            await request.save();
            notifySeller(request, `Customer asked for a revised quotation for ${request.requestId}${note ? `: ${String(note).trim()}` : '.'}`);
        } else {
            return handleResponse(res, 400, 'Invalid action');
        }
        return handleResponse(res, 200, 'Response saved', request);
    } catch (error) {
        console.error('respondToCustomizationQuotation error:', error);
        return handleResponse(res, 500, 'Failed to respond to quotation');
    }
};

export const chooseCustomizationCOD = async (req, res) => {
    try {
        const request = await loadForCustomer(req, res);
        if (!request) return;
        if (request.status !== 'APPROVED' || (Number(request.amountPaid) || 0) > 0) {
            return handleResponse(res, 400, 'Approve the quotation first');
        }
        request.paymentMode = 'COD';
        request.status = 'CONFIRMED';
        await request.save();
        notifySeller(request, `Customer confirmed ${request.requestId} with Cash on Delivery (${money(totalOf(request))}).`);
        return handleResponse(res, 200, 'Confirmed with Cash on Delivery', request);
    } catch (error) {
        return handleResponse(res, 500, 'Failed to confirm COD');
    }
};

export const createCustomizationPaymentOrder = async (req, res) => {
    try {
        const request = await loadForCustomer(req, res);
        if (!request) return;
        if (!['APPROVED', 'CONFIRMED'].includes(request.status)) return handleResponse(res, 400, 'Approve the quotation first');
        const balance = balanceOf(request);
        if (balance <= 0) return handleResponse(res, 400, 'Already fully paid');
        // First payment = advance (seller's advance %); after that = remaining balance.
        const amount = (Number(request.amountPaid) || 0) > 0 ? balance : Math.min(advanceOf(request), balance);
        const keyId = process.env.RAZORPAY_KEY_ID;
        const keySecret = process.env.RAZORPAY_KEY_SECRET;
        if (!keyId || !keySecret) return handleResponse(res, 500, 'Payment gateway is not configured');
        const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
        const order = await razorpay.orders.create({
            amount: Math.round(amount * 100),
            currency: 'INR',
            receipt: `c_${String(request._id).slice(-6)}_${Date.now()}`,
        });
        return handleResponse(res, 200, 'Payment order created', { ...order, keyId, payAmount: amount });
    } catch (error) {
        console.error('createCustomizationPaymentOrder error:', error);
        return handleResponse(res, 500, 'Failed to start payment');
    }
};

export const verifyCustomizationPayment = async (req, res) => {
    try {
        const request = await loadForCustomer(req, res);
        if (!request) return;
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) return handleResponse(res, 400, 'Payment details are required');
        if ((request.razorpayPayments || []).some(p => p.paymentId === razorpay_payment_id)) {
            return handleResponse(res, 200, 'Payment already recorded', request);
        }
        const keySecret = process.env.RAZORPAY_KEY_SECRET;
        if (!keySecret) return handleResponse(res, 500, 'Payment gateway is not configured');
        const expected = crypto.createHmac('sha256', keySecret).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex');
        if (expected !== razorpay_signature) return handleResponse(res, 400, 'Payment verification failed');

        const razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: keySecret });
        const [rzpPayment, rzpOrder] = await Promise.all([
            razorpay.payments.fetch(razorpay_payment_id),
            razorpay.orders.fetch(razorpay_order_id),
        ]);
        if (rzpPayment?.order_id !== razorpay_order_id
            || !['captured', 'authorized'].includes(rzpPayment?.status)
            || !String(rzpOrder?.receipt || '').startsWith(`c_${String(request._id).slice(-6)}_`)) {
            return handleResponse(res, 400, 'Payment does not match this customization');
        }

        const amount = Math.round(Number(rzpPayment.amount || 0)) / 100;
        // Request no longer payable (rejected / cancelled) or already fully paid -> give the money back.
        if (!['APPROVED', 'CONFIRMED'].includes(request.status) || balanceOf(request) <= 0) {
            try {
                await razorpay.payments.refund(razorpay_payment_id, { amount: Math.round(Number(rzpPayment.amount || 0)) });
            } catch (refundError) {
                console.error('Customization refund failed:', refundError?.message || refundError);
            }
            return handleResponse(res, 409, 'This customization can no longer be paid. Your payment will be refunded.');
        }
        request.razorpayPayments = [...(request.razorpayPayments || []), { paymentId: razorpay_payment_id, orderId: razorpay_order_id, amount, paidAt: new Date() }];
        request.amountPaid = round2((Number(request.amountPaid) || 0) + amount);
        if (!request.paymentMode) request.paymentMode = 'ONLINE';
        request.paymentStatus = request.amountPaid >= totalOf(request) - 0.5 ? 'PAID' : 'ADVANCE_PAID';
        request.status = 'CONFIRMED';
        await request.save();

        const isFull = request.paymentStatus === 'PAID';
        notifySeller(request, `${isFull ? 'Full' : 'Advance'} payment of ${money(amount)} received online for ${request.requestId}.`);
        notifyCustomer(request, `Your ${isFull ? '' : 'advance '}payment of ${money(amount)} for ${request.requestId} was successful.`);
        return handleResponse(res, 200, 'Payment successful', request);
    } catch (error) {
        console.error('verifyCustomizationPayment error:', error);
        return handleResponse(res, 500, 'Failed to verify payment');
    }
};

/* ---------------- SELLER ---------------- */

export const getSellerCustomizationRequests = async (req, res) => {
    try {
        const items = await CustomizationRequest.find({ seller: sellerIdOf(req) })
            .populate('customer', 'name phone')
            .sort({ createdAt: -1 })
            .lean();
        return handleResponse(res, 200, 'Customization requests fetched', items);
    } catch (error) {
        return handleResponse(res, 500, 'Failed to fetch customization requests');
    }
};

const loadForSeller = async (req, res) => {
    const request = await CustomizationRequest.findById(req.params.id);
    if (!request) { handleResponse(res, 404, 'Customization request not found'); return null; }
    if (String(request.seller) !== sellerIdOf(req)) { handleResponse(res, 403, 'Unauthorized'); return null; }
    return request;
};

export const sendCustomizationQuotation = async (req, res) => {
    try {
        const request = await loadForSeller(req, res);
        if (!request) return;
        const amount = Number(req.body?.amount);
        const note = String(req.body?.note || '').trim();
        if (!Number.isFinite(amount) || amount <= 0) return handleResponse(res, 400, 'Enter a valid quotation amount');
        if (!['REQUESTED', 'REVISION_REQUESTED', 'QUOTED'].includes(request.status)) {
            return handleResponse(res, 400, 'Quotation can no longer be changed for this request');
        }
        request.quotation = { ...(request.quotation?.toObject?.() || {}), amount: round2(amount), note, sentAt: new Date() };
        request.status = 'QUOTED';
        await request.save();
        await postChatMessage({
            customerId: request.customer, sellerId: request.seller, sender: 'seller',
            text: `Final Quotation (${request.requestId}): ${money(amount)}${note ? `\n${note}` : ''}\nPlease approve it in My Orders > Events.`,
        }).catch(() => {});
        notifyCustomer(request, `Your seller sent a final quotation of ${money(amount)} for ${request.requestId}. Please review and approve.`);
        return handleResponse(res, 200, 'Quotation sent to the customer', request);
    } catch (error) {
        console.error('sendCustomizationQuotation error:', error);
        return handleResponse(res, 500, 'Failed to send quotation');
    }
};

export const rejectCustomizationRequest = async (req, res) => {
    try {
        const request = await loadForSeller(req, res);
        if (!request) return;
        if (!['REQUESTED', 'QUOTED', 'REVISION_REQUESTED'].includes(request.status) || (Number(request.amountPaid) || 0) > 0) {
            return handleResponse(res, 400, 'This request cannot be rejected now (customer already approved / paid)');
        }
        request.status = 'REJECTED';
        request.sellerNote = String(req.body?.note || '').trim();
        await request.save();
        notifyCustomer(request, `Your customization request ${request.requestId} was declined by the seller${request.sellerNote ? `: ${request.sellerNote}` : '.'}`);
        return handleResponse(res, 200, 'Request rejected', request);
    } catch (error) {
        return handleResponse(res, 500, 'Failed to reject request');
    }
};

// Seller records cash: part = 'advance' (only the advance) or the whole balance.
export const confirmCustomizationCOD = async (req, res) => {
    try {
        const request = await loadForSeller(req, res);
        if (!request) return;
        if (request.status !== 'CONFIRMED' || request.paymentMode !== 'COD') {
            return handleResponse(res, 400, 'Customer has not confirmed this request with COD yet');
        }
        const total = totalOf(request);
        const alreadyPaid = Number(request.amountPaid) || 0;
        const advance = advanceOf(request);
        const isAdvance = String(req.body?.part || '').toLowerCase() === 'advance' && alreadyPaid <= 0 && advance > 0 && advance < total;
        const cash = isAdvance ? round2(advance) : round2(Math.max(0, total - alreadyPaid));
        if (cash <= 0) return handleResponse(res, 400, 'Already fully paid');
        request.amountPaid = round2(alreadyPaid + cash);
        request.codAmountCollected = round2((Number(request.codAmountCollected) || 0) + cash);
        request.paymentStatus = isAdvance ? 'ADVANCE_PAID' : 'PAID';
        await request.save();
        notifyCustomer(request, isAdvance
            ? `Advance cash payment of ${money(cash)} for ${request.requestId} has been received by the seller. Balance due: ${money(total - cash)} (cash).`
            : `Cash payment of ${money(cash)} for ${request.requestId} has been received by the seller.`);
        return handleResponse(res, 200, 'Cash payment saved', request);
    } catch (error) {
        return handleResponse(res, 500, 'Failed to save cash payment');
    }
};
