import express from "express";
import { startLiveStream, endLiveStream, getLiveSellers } from "../controllers/liveStreamingController.js";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

// Seller starts a live stream
router.post("/start", verifyToken, allowRoles("seller"), startLiveStream);

// Seller ends a live stream
router.post("/end", verifyToken, allowRoles("seller"), endLiveStream);

// Public/Customer route to get active live sellers
router.get("/active", getLiveSellers);

export default router;
