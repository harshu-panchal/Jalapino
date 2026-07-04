import express from "express";
import {
    signupCustomer,
    loginCustomer,
    verifyCustomerOTP,
    getCustomerProfile,
    updateCustomerProfile,
    getCustomerTransactions,
} from "../controller/customerAuthController.js";
import { saveFcmToken } from "../modules/notifications/notification.controller.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import {
    authRouteRateLimiter,
    createContentLengthGuard,
    otpRouteRateLimiter,
} from "../middleware/securityMiddlewares.js";

const router = express.Router();
const smallAuthPayload = createContentLengthGuard(
    parseInt(process.env.AUTH_MAX_PAYLOAD_BYTES || "16384", 10),
    "Auth payload too large",
);
router.post("/send-signup-otp", authRouteRateLimiter, otpRouteRateLimiter, smallAuthPayload, signupCustomer);
router.post("/send-login-otp", authRouteRateLimiter, otpRouteRateLimiter, smallAuthPayload, loginCustomer);
router.post("/verify-otp", authRouteRateLimiter, otpRouteRateLimiter, smallAuthPayload, verifyCustomerOTP);
router.post("/save-fcm-token", verifyToken, saveFcmToken);

// Profile routes
router.get("/profile", verifyToken, getCustomerProfile);
router.put("/profile", verifyToken, updateCustomerProfile);

// Wallet
router.get("/transactions", verifyToken, getCustomerTransactions);

export default router;
