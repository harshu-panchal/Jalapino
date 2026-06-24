import express from 'express';
import { getAdminPayouts, settlePayout } from '../controller/eventPayoutController.js';
import { verifyToken, allowRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

// Admin routes
router.get('/', verifyToken, allowRoles('admin'), getAdminPayouts);
router.put('/:id/settle', verifyToken, allowRoles('admin'), settlePayout);

export default router;
