import express from "express";
import multer from "multer";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";
import {
  getEventBanners,
  createEventBanners,
  deleteEventBanner,
} from "../controllers/eventBannerController.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

router.get("/", getEventBanners);
router.post("/", verifyToken, allowRoles("admin"), upload.array("images", 5), createEventBanners);
router.delete("/:id", verifyToken, allowRoles("admin"), deleteEventBanner);

export default router;
