import express from "express";
import { verifyToken, allowRoles, requireApprovedSeller, optionalVerifyToken } from "../middleware/authMiddleware.js";
import { 
    createService, 
    getSellerServices, 
    getActiveLiveServices,
    enrollService,
    getCustomerEnrollments,
    getSellerEnrollments
} from "../controller/serviceController.js";

const router = express.Router();

// Customer / Public Routes
router.get("/live", optionalVerifyToken, getActiveLiveServices);

// Customer Enrollment Routes
router.post("/enroll", verifyToken, allowRoles("customer"), enrollService);
router.get("/enrollments/me", verifyToken, allowRoles("customer"), getCustomerEnrollments);

// Seller Routes
router.post("/", verifyToken, allowRoles("seller"), requireApprovedSeller, createService);
router.get("/seller", verifyToken, allowRoles("seller"), requireApprovedSeller, getSellerServices);
router.get("/enrollments/seller", verifyToken, allowRoles("seller"), requireApprovedSeller, getSellerEnrollments);

export default router;
