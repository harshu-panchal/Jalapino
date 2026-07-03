import express from "express";
import { updateStreamUrl, addPhotoUpdate, getLiveKitchenStatus } from "../controller/liveKitchenController.js";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public routes (Customers)
router.get("/:sellerId", getLiveKitchenStatus);
router.get("/:sellerId/:orderId", getLiveKitchenStatus);

// Private routes (Sellers)
router.post("/stream", verifyToken, allowRoles("seller"), updateStreamUrl);
router.post("/photo", verifyToken, allowRoles("seller"), addPhotoUpdate);

export default router;
