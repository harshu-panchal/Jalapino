import express from 'express';
import { createEventBooking, getMyEventBookings, getEventBookingDetails, updateEventBooking, deleteEventBooking } from '../controller/eventBookingController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Customer routes
router.post('/book', verifyToken, createEventBooking);
router.get('/my-bookings', verifyToken, getMyEventBookings);
router.get('/:id', verifyToken, getEventBookingDetails);
router.put('/:id', verifyToken, updateEventBooking);
router.delete('/:id', verifyToken, deleteEventBooking);

export default router;
