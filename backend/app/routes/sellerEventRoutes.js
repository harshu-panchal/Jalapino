import express from 'express';
import { getEventDashboardStats, getEventReservations, updateReservationStatus } from '../controller/sellerEventController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes here should be protected with seller token
router.get('/dashboard', verifyToken, getEventDashboardStats);
router.get('/reservations', verifyToken, getEventReservations);
router.put('/reservations/:id/status', verifyToken, updateReservationStatus);

export default router;
