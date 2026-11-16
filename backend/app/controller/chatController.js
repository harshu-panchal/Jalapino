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

        res.status(200).json({ status: true, result: session, sellerSettings });
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

        res.status(200).json({ status: true, result: sessions });
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
