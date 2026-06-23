import express from 'express';
import { getEventTypes, getEventCategories, seedEventConfig, getCities } from '../controller/eventConfigController.js';

const router = express.Router();

// Public/Customer routes
router.get('/types', getEventTypes);
router.get('/categories', getEventCategories);
router.get('/cities', getCities);

// Development/Seed route (Can be protected by admin middleware in production)
router.post('/seed', seedEventConfig);

export default router;
