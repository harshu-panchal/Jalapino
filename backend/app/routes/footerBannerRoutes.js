import express from "express";
import multer from "multer";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";
import {
  getFooterBanners,
  createFooterBanner,
  deleteFooterBanner,
} from "../controllers/footerBannerController.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

router.get("/", getFooterBanners);
router.post("/", verifyToken, allowRoles("admin"), upload.single("image"), createFooterBanner);
router.delete("/:id", verifyToken, allowRoles("admin"), deleteFooterBanner);

export default router;
