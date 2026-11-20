import EventChatSession from '../models/event/EventChatSession.js';
import Seller from '../models/seller.js';

// Customization options the admin enabled for this seller (read fresh from DB).
const SELLER_CUSTOMIZATION_FIELDS = 'customizationEngineEnabled quoteThemeSelection quoteBudgetSelection quoteReferencePhotoUpload quoteColorCombination quoteCustomerNotes quoteSellerQuotation quoteQuoteRevision quoteCustomerApproval availableColors';

export const getChatSession = async (req, res) => {
    try {
        const { sellerId } = req.query;
        const customerId = req.user.id || req.user._id; // token gives { id, role }

        if (!sellerId) {
            return res.status(400).json({ status: false, message: 'sellerId is required' });
        }

        const sellerSettings = await Seller.findById(sellerId).select(SELLER_CUSTOMIZATION_FIELDS).lean().catch(() => null);

        let session = await EventChatSession.findOne({
            customer: customerId,
            seller: sellerId,
            status: 'active'
        }).populate('seller', 'name shopName')
          .populate('customer', 'name');

        if (!session) {
            // We do not create it here; it will be created on the first message via socket or explicit POST
            return res.status(200).json({ status: true, result: null, sellerSettings });
        }

        // Customer deleted this chat earlier -> show only newer messages.
        const result = typeof session.toObject === 'function' ? session.toObject() : { ...session };
        if (result.customerClearedAt) {
            const clearedAt = new Date(result.customerClearedAt).getTime();
            result.messages = (result.messages || []).filter(m => new Date(m.createdAt).getTime() > clearedAt);
        }
        // Messages the customer deleted one by one.
        result.messages = (result.messages || []).filter(m => !m.hiddenForCustomer);

        res.status(200).json({ status: true, result, sellerSettings });
    } catch (error) {
        console.error('Error in getChatSession:', error);
        res.status(500).json({ status: false, message: 'Server error' });
    }
};

export const getSellerChats = async (req, res) => {
    try {
        const sellerId = req.user.id || req.user._id; // token gives { id, role }

        const sessions = await EventChatSession.find({
            seller: sellerId,
            status: 'active'
        })
        .populate('customer', 'name phone email profilePic')
        .sort({ lastMessageAt: -1 });

        // Seller deleted a chat earlier -> show only newer messages; hide it if none.
        const result = sessions.map(doc => {
            const raw = typeof doc.toObject === 'function' ? doc.toObject() : doc;
            // Messages the seller deleted one by one.
            const s = { ...raw, messages: (raw.messages || []).filter(m => !m.hiddenForSeller) };
            if (!s.sellerClearedAt) return s;
            const clearedAt = new Date(s.sellerClearedAt).getTime();
            return { ...s, messages: (s.messages || []).filter(m => new Date(m.createdAt).getTime() > clearedAt) };
        }).filter(s => !s.sellerClearedAt || (s.messages || []).length > 0);

        res.status(200).json({ status: true, result });
    } catch (error) {
        console.error('Error in getSellerChats:', error);
        res.status(500).json({ status: false, message: 'Server error' });
    }
};

export const markMessagesAsRead = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const role = req.user.role; // 'customer' or 'seller'
        const expectedSender = role === 'customer' ? 'seller' : 'customer';

        const session = await EventChatSession.findById(sessionId);
        if (!session) {
            return res.status(404).json({ status: false, message: 'Session not found' });
        }

        // Mark all messages from the OTHER party as read
        let modified = false;
        session.messages.forEach(msg => {
            if (msg.sender === expectedSender && !msg.isRead) {
                msg.isRead = true;
                modified = true;
            }
        });

        if (modified) {
            await session.save();
        }

        res.status(200).json({ status: true, message: 'Messages marked as read' });
    } catch (error) {
        console.error('Error in markMessagesAsRead:', error);
        res.status(500).json({ status: false, message: 'Server error' });
    }
};

// Delete a chat for the person asking (customer or seller) - like "Delete chat".
// The other side keeps its copy; once both sides deleted it, it is removed from DB.
export const deleteChatSession = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const userId = String(req.user.sellerId || req.user.id || req.user._id || '');
        const role = String(req.user.role || '').toLowerCase();

        const session = await EventChatSession.findById(sessionId);
        if (!session) {
            return res.status(404).json({ status: false, message: 'Chat not found' });
        }
        const isSeller = role === 'seller' && String(session.seller) === userId;
        const isCustomer = role !== 'seller' && String(session.customer) === String(req.user.id || req.user._id || '');
        if (!isSeller && !isCustomer) {
            return res.status(403).json({ status: false, message: 'Not allowed' });
        }

        const now = new Date();
        if (isSeller) session.sellerClearedAt = now;
        else session.customerClearedAt = now;

        const lastAt = session.messages.length
            ? new Date(session.messages[session.messages.length - 1].createdAt || session.lastMessageAt).getTime()
            : 0;
        const bothCleared = session.sellerClearedAt && session.customerClearedAt
            && new Date(session.sellerClearedAt).getTime() >= lastAt
            && new Date(session.customerClearedAt).getTime() >= lastAt;

        if (bothCleared) {
            await EventChatSession.deleteOne({ _id: session._id });
        } else {
            await session.save();
        }

        res.status(200).json({ status: true, message: 'Chat deleted', result: { removedFromDb: Boolean(bothCleared) } });
    } catch (error) {
        console.error('Error in deleteChatSession:', error);
        res.status(500).json({ status: false, message: 'Server error' });
    }
};

// Delete ONE message for the person asking ("delete for me").
// The other side still sees it; once both deleted it, it is removed from DB.
export const deleteChatMessage = async (req, res) => {
    try {
        const { sessionId, messageId } = req.params;
        const role = String(req.user.role || '').toLowerCase();
        const session = await EventChatSession.findById(sessionId);
        if (!session) {
            return res.status(404).json({ status: false, message: 'Chat not found' });
        }
        const isSeller = role === 'seller' && String(session.seller) === String(req.user.sellerId || req.user.id || req.user._id || '');
        const isCustomer = role !== 'seller' && String(session.customer) === String(req.user.id || req.user._id || '');
        if (!isSeller && !isCustomer) {
            return res.status(403).json({ status: false, message: 'Not allowed' });
        }
        const index = (session.messages || []).findIndex(m => String(m._id) === String(messageId));
        if (index === -1) {
            return res.status(404).json({ status: false, message: 'Message not found' });
        }
        const message = session.messages[index];
        if (isSeller) message.hiddenForSeller = true;
        else message.hiddenForCustomer = true;

        const removedFromDb = Boolean(message.hiddenForSeller && message.hiddenForCustomer);
        if (removedFromDb) session.messages.splice(index, 1);
        await session.save();

        res.status(200).json({ status: true, message: 'Message deleted', result: { removedFromDb } });
    } catch (error) {
        console.error('Error in deleteChatMessage:', error);
        res.status(500).json({ status: false, message: 'Server error' });
    }
};
