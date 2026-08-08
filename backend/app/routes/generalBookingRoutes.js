import express from 'express';
import { verifyToken, allowRoles } from '../middleware/authMiddleware.js';
import {
  createBooking,
  verifyPayment,
  getMyTickets,
  scanTicket,
  getSellerGeneralBookings,
  updateTicketDetails,
  cancelTicket,
  completeAddonService,
  reviewAddonService
} from '../controller/event/generalBookingController.js';

const router = express.Router();

// Customer Endpoints
router.post('/general-booking/create', verifyToken, createBooking);
router.post('/general-booking/verify', verifyToken, verifyPayment);
router.get('/general-booking/my-tickets', verifyToken, getMyTickets);
router.put('/general-booking/tickets/:id', verifyToken, updateTicketDetails);
router.put('/general-booking/tickets/:id/cancel', verifyToken, cancelTicket);
router.put('/general-booking/bookings/:bookingId/addons/:addonId/review', verifyToken, reviewAddonService);

// Seller Endpoints
router.post('/seller/general-booking/scan', verifyToken, allowRoles('seller'), scanTicket);
router.get('/seller/general-booking/bookings', verifyToken, allowRoles('seller'), getSellerGeneralBookings);
router.put('/seller/general-booking/bookings/:bookingId/addons/:addonId/complete', verifyToken, allowRoles('seller'), completeAddonService);

export default router;
