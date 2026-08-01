import express from 'express';
import BookingManagement from '../models/bookingManagement.js';
import { verifyToken, allowRoles } from '../middleware/authMiddleware.js';
import {
  createOfflineBooking,
  getSellerBookings,
  updateBooking,
  deleteBooking,
  requestPhysicalVisit,
  confirmPhysicalVisit,
  completePhysicalVisit,
  submitSellerReview,
  submitCustomerReview,
  getSellerPolicies,
  updateSellerPolicies,
  cancelBooking,
  getCustomerBookings,
} from '../controller/bookingManagementController.js';

const router = express.Router();

// Seller: Create Booking (Offline)
router.post(
  '/bookings',
  verifyToken,
  allowRoles('seller'),
  createOfflineBooking
);

// Seller: Get Bookings
router.get(
  '/bookings',
  verifyToken,
  allowRoles('seller'),
  getSellerBookings
);

// Seller: Update Booking
router.patch(
  '/bookings/:id',
  verifyToken,
  allowRoles('seller'),
  updateBooking
);

// Seller: Delete Booking
router.delete(
  '/bookings/:id',
  verifyToken,
  allowRoles('seller'),
  deleteBooking
);
// Admin: Get Bookings of a specific seller
router.get(
  '/admin/sellers/:sellerId/bookings',
  verifyToken,
  allowRoles('admin'),
  async (req, res) => {
    try {
      const { sellerId } = req.params;
      const bookings = await BookingManagement.find({ sellerId }).sort({ bookingDate: 1 });
      const handleResponse = await import('../utils/helper.js').then(m => m.default);
      return handleResponse(res, 200, 'Seller bookings fetched successfully', bookings);
    } catch (error) {
      const handleResponse = await import('../utils/helper.js').then(m => m.default);
      return handleResponse(res, 500, error.message);
    }
  }
);

// Physical Visit Workflow
router.patch('/bookings/:id/request-visit', verifyToken, requestPhysicalVisit);
router.patch('/bookings/:id/confirm-visit', verifyToken, allowRoles('seller'), confirmPhysicalVisit);
router.patch('/bookings/:id/complete-visit', verifyToken, allowRoles('seller'), completePhysicalVisit);

// Mutual Reviews Workflow
router.post('/bookings/:id/submit-customer-review', verifyToken, submitSellerReview);
router.post('/bookings/:id/submit-seller-review', verifyToken, allowRoles('seller'), submitCustomerReview);

// Cancellation & Policies Workflow
router.get('/cancellation-policies', verifyToken, allowRoles('seller'), getSellerPolicies);
router.put('/cancellation-policies', verifyToken, allowRoles('seller'), updateSellerPolicies);
router.post('/bookings/:id/cancel', verifyToken, cancelBooking);

// Customer: Get own bookings
router.get('/bookings/mine', verifyToken, getCustomerBookings);

export default router;
