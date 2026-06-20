import express from "express";
import {
    listCoupons,
    createCoupon,
    updateCoupon,
    deleteCoupon,
    validateCoupon,
} from "../controller/couponController.js";

import { verifyToken, allowRoles, requireAdminRole } from "../middleware/authMiddleware.js";

const router = express.Router();

// Admin management
router.get("/admin/coupons", verifyToken, allowRoles("admin"), requireAdminRole("super_admin", "marketing"), listCoupons);
router.post("/admin/coupons", verifyToken, allowRoles("admin"), requireAdminRole("super_admin", "marketing"), createCoupon);
router.put("/admin/coupons/:id", verifyToken, allowRoles("admin"), requireAdminRole("super_admin", "marketing"), updateCoupon);
router.delete("/admin/coupons/:id", verifyToken, allowRoles("admin"), requireAdminRole("super_admin", "marketing"), deleteCoupon);

// Customer‑facing
router.post("/coupons/validate", validateCoupon);
router.get("/coupons", listCoupons);

export default router;

