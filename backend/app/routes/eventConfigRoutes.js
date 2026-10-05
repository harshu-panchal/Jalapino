import express from 'express';
import { getEventTypes, getEventCategories, seedEventConfig, getCities, getFacilities, getPaymentModes, getDeliveryCoverageTypes, getProductColors } from '../controller/eventConfigController.js';

const router = express.Router();

// Public/Customer routes
router.get('/types', getEventTypes);
router.get('/categories', getEventCategories);
router.get('/cities', getCities);
router.get('/facilities', getFacilities);
router.get('/payment-modes', getPaymentModes);
router.get('/delivery-coverage-types', getDeliveryCoverageTypes);
router.get('/product-colors', getProductColors);

// Development/Seed route (Can be protected by admin middleware in production)
router.post('/seed', seedEventConfig);

export default router;
