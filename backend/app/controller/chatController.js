import EventChatSession from '../models/event/EventChatSession.js';

export const getChatSession = async (req, res) => {
    try {
        const { sellerId } = req.query;
        const customerId = req.user._id;

        if (!sellerId) {
            return res.status(400).json({ status: false, message: 'sellerId is required' });
        }

        let session = await EventChatSession.findOne({
            customer: customerId,
            seller: sellerId,
            status: 'active'
        }).populate('seller', 'name shopName')
          .populate('customer', 'name');

        if (!session) {
            // We do not create it here; it will be created on the first message via socket or explicit POST
            return res.status(200).json({ status: true, result: null });
        }

        res.status(200).json({ status: true, result: session });
    } catch (error) {
        console.error('Error in getChatSession:', error);
        res.status(500).json({ status: false, message: 'Server error' });
    }
};

export const getSellerChats = async (req, res) => {
    try {
        const sellerId = req.user._id;

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
