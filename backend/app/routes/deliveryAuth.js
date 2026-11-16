import express from "express";
import {
  signupDelivery,
  loginDelivery,
  verifyDeliveryOTP,
  getDeliveryProfile,
  updateDeliveryProfile,
} from "../controller/deliveryAuthController.js";
import {
  getDeliveryStats,
  getDeliveryEarnings,
  getDeliveryCodCashSummary,
  submitDeliveryCodCashToAdmin,
  getMyDeliveryOrders,
  requestWithdrawal,
  updateDeliveryLocation,
} from "../controller/deliveryController.js";
import { getRiderWalletSummaryController } from "../controller/adminFinanceController.js";
import { saveFcmToken } from "../modules/notifications/notification.controller.js";

import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const router = express.Router();

// Signup photos/documents (camera or gallery) are saved on this server with multer
// in uploads/delivery/<profiles|documents>, served at /api/images/...
const STORAGE_BASE_PATH = process.env.STORAGE_BASE_PATH || path.join(process.cwd(), "uploads");
const signupStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = file.fieldname === "profileImage" ? "profiles" : "documents";
    const dir = path.join(STORAGE_BASE_PATH, "delivery", folder);
    fs.mkdir(dir, { recursive: true }, (error) => cb(error, dir));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
    cb(null, `${file.fieldname}-${randomUUID()}${ext}`);
  },
});
const signupUpload = multer({
  storage: signupStorage,
  limits: { fileSize: 15 * 1024 * 1024 }, // camera photos can be large
  fileFilter: (req, file, cb) => {
    if (String(file.mimetype || "").startsWith("image/")) return cb(null, true);
    cb(new Error("Only image files are allowed"));
  },
});
const handleSignupUpload = (req, res, next) => {
  signupUpload.any()(req, res, (error) => {
    if (!error) return next();
    const message = error.code === "LIMIT_FILE_SIZE" ? "Image is too large (max 15 MB)" : error.message || "Upload failed";
    return res.status(400).json({ success: false, error: true, message });
  });
};

router.post(
  "/send-signup-otp",
  handleSignupUpload,
  signupDelivery,
);
router.post("/send-login-otp", loginDelivery);
router.post("/verify-otp", verifyDeliveryOTP);
router.post("/save-fcm-token", verifyToken, saveFcmToken);

// Profile routes
router.get("/profile", verifyToken, getDeliveryProfile);
router.put("/profile", verifyToken, updateDeliveryProfile);
router.get("/stats", verifyToken, getDeliveryStats);
router.get("/earnings", verifyToken, getDeliveryEarnings);
router.get("/cod/summary", verifyToken, allowRoles("delivery"), getDeliveryCodCashSummary);
router.post("/cod/pay", verifyToken, allowRoles("delivery"), submitDeliveryCodCashToAdmin);
router.get("/wallet/summary", verifyToken, allowRoles("delivery"), getRiderWalletSummaryController);
router.get(
  "/order-history",
  verifyToken,
  allowRoles("delivery"),
  getMyDeliveryOrders,
);
router.post("/request-withdrawal", verifyToken, requestWithdrawal);
router.post("/location", verifyToken, updateDeliveryLocation);

// NOTE: Delivery-completion OTP generation/validation lives on the
// canonical workflow routes:
//   POST /orders/workflow/:orderId/otp/request
//   POST /orders/workflow/:orderId/otp/verify
// The previous /delivery/orders/:orderId/(generate|validate)-otp
// endpoints were removed once the workflow state machine became the
// single source of truth (see backend/app/services/orderWorkflowService.js
// requestHandoffOtpAtomic / verifyHandoffOtpAndDeliver).

export default router;
