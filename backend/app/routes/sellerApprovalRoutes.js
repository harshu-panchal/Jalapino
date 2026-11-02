import express from 'express';
import { getEventRequests, updateRequestStatus, sendEventQuotation } from '../controller/sellerApprovalController.js';
import { verifyToken, allowRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/event-requests', verifyToken, allowRoles('seller'), getEventRequests);
router.put('/event-requests/:id/status', verifyToken, allowRoles('seller'), updateRequestStatus);
router.put('/event-requests/:id/quotation', verifyToken, allowRoles('seller'), sendEventQuotation);

export default router;
