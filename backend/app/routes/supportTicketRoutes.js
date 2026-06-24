import express from 'express';
import { createTicket, getMyTickets, getAllTickets, updateTicketStatus } from '../controller/supportTicketController.js';
import { verifyToken, allowRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

// Customer/Seller routes
router.post('/', verifyToken, createTicket);
router.get('/my-tickets', verifyToken, getMyTickets);

// Admin routes
router.get('/', verifyToken, allowRoles('admin'), getAllTickets);
router.put('/:id/status', verifyToken, allowRoles('admin'), updateTicketStatus);

export default router;
