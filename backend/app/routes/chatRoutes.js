import express from 'express';
import { getChatSession, getSellerChats, markMessagesAsRead } from '../controller/chatController.js';
import { verifyToken, allowRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

// Customer or Seller can fetch the chat session
router.get('/session', verifyToken, getChatSession);

// Seller fetches all their active chats
router.get('/seller/sessions', verifyToken, allowRoles('seller'), getSellerChats);

// Mark messages as read
router.post('/session/:sessionId/read', verifyToken, markMessagesAsRead);

export default router;
