import express from "express";
import { updateStreamUrl, addPhotoUpdate, getLiveKitchenStatus, getPublicLiveStreams, toggleStreamLike } from "../controller/liveKitchenController.js";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public routes (Customers)
router.get("/public/streams", getPublicLiveStreams);
router.get("/:sellerId", getLiveKitchenStatus);
router.get("/:sellerId/:orderId", getLiveKitchenStatus);

// Private routes (Customers)
router.post("/streams/:id/like", verifyToken, allowRoles("customer"), toggleStreamLike);

// Private routes (Sellers)
router.post("/stream", verifyToken, allowRoles("seller"), updateStreamUrl);
router.post("/photo", verifyToken, allowRoles("seller"), addPhotoUpdate);

export default router;
