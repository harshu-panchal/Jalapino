import express from 'express';
import { getCalendarConfig, updateBlockedDates } from '../controller/sellerCalendarController.js';
import { verifyToken, requireApprovedSeller } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', verifyToken, requireApprovedSeller, getCalendarConfig);
router.put('/blocked-dates', verifyToken, requireApprovedSeller, updateBlockedDates);

export default router;
