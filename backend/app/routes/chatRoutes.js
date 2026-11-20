import express from 'express';
import { getChatSession, getSellerChats, markMessagesAsRead, deleteChatSession, deleteChatMessage } from '../controller/chatController.js';
import { verifyToken, allowRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

// Customer or Seller can fetch the chat session
router.get('/session', verifyToken, getChatSession);

// Seller fetches all their active chats
router.get('/seller/sessions', verifyToken, allowRoles('seller'), getSellerChats);

// Mark messages as read
router.post('/session/:sessionId/read', verifyToken, markMessagesAsRead);

// Delete a chat (customer or seller, only their own side)
router.delete('/session/:sessionId', verifyToken, deleteChatSession);
// Delete one message (only for the person deleting it)
router.delete('/session/:sessionId/messages/:messageId', verifyToken, deleteChatMessage);

export default router;
