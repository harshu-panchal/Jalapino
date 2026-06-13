import express from "express";
import {
    getCustomerReferralDetails,
    getAdminReferralConfig,
    updateAdminReferralConfig,
    getAdminReferralStats
} from "../controller/referralController.js";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

// Customer referral detail routes
router.get("/details", verifyToken, getCustomerReferralDetails);

// Admin referral program config and metrics routes
router.get("/admin/config", verifyToken, allowRoles("admin"), getAdminReferralConfig);
router.put("/admin/config", verifyToken, allowRoles("admin"), updateAdminReferralConfig);
router.get("/admin/stats", verifyToken, allowRoles("admin"), getAdminReferralStats);

export default router;
