import express from "express";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";
import {
  uploadCustomerImage,
  getPendingCustomerImages,
  approveCustomerImage,
  rejectCustomerImage
} from "../controller/customerImageController.js";

import multer from "multer";
import path from "path";

const router = express.Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// Customer route to upload an image
router.post("/upload", verifyToken, allowRoles("customer", "user"), upload.single("image"), uploadCustomerImage);

// Seller/Admin routes to view and review
router.get("/queue", verifyToken, allowRoles("seller", "admin", "super_admin", "sub_admin"), getPendingCustomerImages);
router.put("/:id/approve", verifyToken, allowRoles("seller", "admin", "super_admin", "sub_admin"), approveCustomerImage);
router.put("/:id/reject", verifyToken, allowRoles("seller", "admin", "super_admin", "sub_admin"), rejectCustomerImage);

export default router;
