import express from 'express';
import { getAllConfigs, updateConfig } from '../controller/appConfigController.js';
import { verifyToken, allowRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', verifyToken, allowRoles('admin'), getAllConfigs);
router.put('/', verifyToken, allowRoles('admin'), updateConfig);

export default router;
