import express from 'express';
import { verifyToken, allowRoles } from '../middleware/authMiddleware.js';
import {
  getSellerAdvanceBookings,
  acceptAdvanceBooking,
  completeDecoration,
} from '../controller/advanceBookingController.js';

const router = express.Router();

// Fetch bookings for the logged-in seller
router.get(
  '/advance-bookings',
  verifyToken,
  allowRoles('seller'),
  getSellerAdvanceBookings
);

// Seller accepts an advance booking
router.patch(
  '/advance-bookings/:id/accept',
  verifyToken,
  allowRoles('seller'),
  acceptAdvanceBooking
);

// Seller marks a booking's decoration as complete
router.patch(
  '/advance-bookings/:id/decoration-complete',
  verifyToken,
  allowRoles('seller'),
  completeDecoration
);

export default router;
