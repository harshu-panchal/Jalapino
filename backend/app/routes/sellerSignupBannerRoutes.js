import express from "express";
import multer from "multer";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";
import {
  uploadBanners,
  getAllBanners,
  getActiveBanners,
  deleteBanner,
  updateBanner,
} from "../controllers/sellerSignupBannerController.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit per file
});

// Admin routes
router.post(
  "/admin/seller-signup-banners",
  verifyToken,
  allowRoles("admin"),
  upload.array("images", 10),
  uploadBanners
);
router.get("/admin/seller-signup-banners", verifyToken, allowRoles("admin"), getAllBanners);
router.delete("/admin/seller-signup-banners/:id", verifyToken, allowRoles("admin"), deleteBanner);
router.put("/admin/seller-signup-banners/:id", verifyToken, allowRoles("admin"), updateBanner);

// Public route (for seller signup page)
router.get("/seller-signup-banners", getActiveBanners);

export default router;
