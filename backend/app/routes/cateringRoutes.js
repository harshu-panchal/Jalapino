import express from "express";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";
import {
    createService, getServices, updateService, deleteService,
    createPackage, getPackages, updatePackage, deletePackage,
    getBookings, getBookingDetails, updateBookingStatus, updatePaymentStatus,
    getDashboardStats, createRazorpayOrder, verifyRazorpayPayment
} from "../controller/cateringAdminController.js";
import {
    getActiveServices, getActivePackages, submitBooking
} from "../controller/cateringCustomerController.js";

const router = express.Router();

const adminAuth = [verifyToken, allowRoles("admin")];

// ------------------------------------
// Admin Routes (Protected by adminAuth)
// ------------------------------------

// Dashboard
router.get("/admin/dashboard", adminAuth, getDashboardStats);

// Services
router.post("/admin/services", adminAuth, createService);
router.get("/admin/services", adminAuth, getServices);
router.put("/admin/services/:id", adminAuth, updateService);
router.delete("/admin/services/:id", adminAuth, deleteService);

// Packages
router.post("/admin/packages", adminAuth, createPackage);
router.get("/admin/packages", adminAuth, getPackages);
router.put("/admin/packages/:id", adminAuth, updatePackage);
router.delete("/admin/packages/:id", adminAuth, deletePackage);

// Bookings
router.get("/admin/bookings", adminAuth, getBookings);
router.get("/admin/bookings/:id", adminAuth, getBookingDetails);
router.put("/admin/bookings/:id/status", adminAuth, updateBookingStatus);
router.put("/admin/bookings/:id/payment", adminAuth, updatePaymentStatus);

// Payments (Razorpay)
router.post("/admin/payments/razorpay/create-order", adminAuth, createRazorpayOrder);
router.post("/admin/payments/razorpay/verify", adminAuth, verifyRazorpayPayment);

// ------------------------------------
// Customer/Public Routes
// ------------------------------------
router.get("/services", getActiveServices);
router.get("/packages", getActivePackages);
router.post("/bookings", submitBooking);

export default router;
