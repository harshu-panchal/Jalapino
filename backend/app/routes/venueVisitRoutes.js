import express from 'express';
import { verifyToken, allowRoles } from '../middleware/authMiddleware.js';
import {
  searchVenues,
  createVisitRequests,
  getCustomerVisitRequests,
  getSellerVisitRequests,
  updateVisitRequestStatus,
  getVenueAvailability,
  setVenueAvailability,
} from '../controller/event/venueVisitController.js';

const router = express.Router();

router.get('/venues/search', searchVenues);
router.post('/venues/visit-requests', verifyToken, createVisitRequests);
router.get('/venues/visit-requests/mine', verifyToken, getCustomerVisitRequests);
router.get('/seller/venues/visit-requests', verifyToken, allowRoles('seller'), getSellerVisitRequests);
router.patch('/venues/visit-requests/:id/status', verifyToken, updateVisitRequestStatus);
router.get('/venues/availability', verifyToken, getVenueAvailability);
router.post('/venues/availability', verifyToken, allowRoles('seller'), setVenueAvailability);

export default router;
