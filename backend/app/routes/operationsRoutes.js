import express from 'express';
import { getSystemHealth, getSystemLogs, createSystemLog, resolveLog } from '../controller/operationsController.js';
import { verifyToken, allowRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

// Admin only routes
router.get('/health', verifyToken, allowRoles('admin'), getSystemHealth);
router.get('/logs', verifyToken, allowRoles('admin'), getSystemLogs);
router.post('/logs', verifyToken, allowRoles('admin'), createSystemLog); // For manual testing or frontend error reporting
router.put('/logs/:id/resolve', verifyToken, allowRoles('admin'), resolveLog);

export default router;
