import express from "express";
import multer from "multer";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";
import {
  uploadVideo,
  getAdminVideos,
  getPublicVideos,
  updateVideo,
  deleteVideo,
} from "../controller/homeVideoController.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB video limit
});

// Public endpoints
router.get("/home-videos", getPublicVideos);

// Admin-only endpoints
router.post("/admin/home-videos", verifyToken, allowRoles("admin"), upload.single("video"), uploadVideo);
router.get("/admin/home-videos", verifyToken, allowRoles("admin"), getAdminVideos);
router.patch("/admin/home-videos/:id", verifyToken, allowRoles("admin"), updateVideo);
router.delete("/admin/home-videos/:id", verifyToken, allowRoles("admin"), deleteVideo);

export default router;
