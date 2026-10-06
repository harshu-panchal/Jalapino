import express from "express";
import {
    getProducts,
    getSellerProducts,
    getSellerProductById,
    createProduct,
    updateProduct,
    deleteProduct,
    getProductById,
    getModerationProducts,
    approveProduct,
    rejectProduct,
} from "../controller/productController.js";
import { adjustStock, getStockHistory } from "../controller/stockController.js";
import {
    verifyToken,
    allowRoles,
    requireAdminRole,
    optionalVerifyToken,
    requireApprovedSeller,
} from "../middleware/authMiddleware.js";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const STORAGE_BASE_PATH = process.env.STORAGE_BASE_PATH || path.join(process.cwd(), "uploads");
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(STORAGE_BASE_PATH, "products");
        fs.mkdir(uploadDir, { recursive: true }, (error) => cb(error, uploadDir));
    },
    filename: (req, file, cb) => {
        const extension = path.extname(file.originalname).toLowerCase();
        cb(null, `product-${randomUUID()}${extension}`);
    },
});
const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        if (String(file.mimetype || "").startsWith("image/")) return cb(null, true);
        cb(new Error("Only image files are allowed for product photos"));
    },
});

const router = express.Router();

// Public routes with optional auth (to detect admin/seller vs customer)
router.get("/", optionalVerifyToken, getProducts);

// Seller protected routes
router.get("/seller/me", verifyToken, allowRoles("seller"), requireApprovedSeller, getSellerProducts);
router.get("/stock-history", verifyToken, allowRoles("seller"), requireApprovedSeller, getStockHistory);
router.get("/seller/:id", verifyToken, allowRoles("seller"), requireApprovedSeller, getSellerProductById);
router.post("/adjust-stock", verifyToken, allowRoles("seller"), requireApprovedSeller, adjustStock);
router.get("/moderation", verifyToken, allowRoles("admin"), requireAdminRole("super_admin", "sub_admin"), getModerationProducts);
router.patch("/moderation/:id/approve", verifyToken, allowRoles("admin"), requireAdminRole("super_admin", "sub_admin"), approveProduct);
router.patch("/moderation/:id/reject", verifyToken, allowRoles("admin"), requireAdminRole("super_admin", "sub_admin"), rejectProduct);
router.get("/:id", optionalVerifyToken, getProductById);

router.post(
    "/",
    verifyToken,
    allowRoles("seller", "admin"),
    requireAdminRole("super_admin", "sub_admin"),
    requireApprovedSeller,
    upload.any(),
    createProduct
);

router.put(
    "/:id",
    verifyToken,
    allowRoles("seller", "admin"),
    requireAdminRole("super_admin", "sub_admin"),
    requireApprovedSeller,
    upload.any(),
    updateProduct
);

router.delete(
    "/:id",
    verifyToken,
    allowRoles("seller", "admin"),
    requireAdminRole("super_admin", "sub_admin"),
    requireApprovedSeller,
    deleteProduct
);

export default router;
