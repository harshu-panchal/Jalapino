import express from 'express';
import { verifyToken, allowRoles } from '../middleware/authMiddleware.js';
import {
    createCustomizationRequest,
    getMyCustomizationRequests,
    respondToCustomizationQuotation,
    chooseCustomizationCOD,
    createCustomizationPaymentOrder,
    verifyCustomizationPayment,
    getSellerCustomizationRequests,
    sendCustomizationQuotation,
    rejectCustomizationRequest,
    confirmCustomizationCOD,
} from '../controller/customizationController.js';

// Customization & Quotation (separate from event bookings)
const router = express.Router();

// Seller
router.get('/seller/list', verifyToken, allowRoles('seller'), getSellerCustomizationRequests);
router.put('/seller/:id/quotation', verifyToken, allowRoles('seller'), sendCustomizationQuotation);
router.put('/seller/:id/reject', verifyToken, allowRoles('seller'), rejectCustomizationRequest);
router.put('/seller/:id/cod-paid', verifyToken, allowRoles('seller'), confirmCustomizationCOD);

// Customer
router.post('/', verifyToken, createCustomizationRequest);
router.get('/my', verifyToken, getMyCustomizationRequests);
router.post('/:id/respond', verifyToken, respondToCustomizationQuotation);
router.post('/:id/cod', verifyToken, chooseCustomizationCOD);
router.post('/:id/payment/order', verifyToken, createCustomizationPaymentOrder);
router.post('/:id/payment/verify', verifyToken, verifyCustomizationPayment);

export default router;
