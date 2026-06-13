import express from "express";
import {
    getWheelState,
    spinWheel,
    scratchCard,
    getRewards,
    createReward,
    updateReward,
    deleteReward,
    getStats,
} from "../controller/gamificationController.js";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

// Customer Endpoints (requires standard user login token)
router.get("/state", verifyToken, getWheelState);
router.post("/spin", verifyToken, spinWheel);
router.post("/scratch", verifyToken, scratchCard);

// Admin Endpoints (requires admin token)
router.get("/admin/rewards", verifyToken, allowRoles("admin"), getRewards);
router.post("/admin/rewards", verifyToken, allowRoles("admin"), createReward);
router.put("/admin/rewards/:id", verifyToken, allowRoles("admin"), updateReward);
router.delete("/admin/rewards/:id", verifyToken, allowRoles("admin"), deleteReward);
router.get("/admin/stats", verifyToken, allowRoles("admin"), getStats);

export default router;
