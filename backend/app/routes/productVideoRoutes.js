import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { checkVideoUploadIntent, uploadProductVideo, getActivePlans, subscribeToPlan, createSubscriptionOrder } from "../controller/productVideoController.js";
import { verifyToken, allowRoles, requireApprovedSeller } from "../middleware/authMiddleware.js";

const router = express.Router();

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'uploads/videos/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'product-video-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
        cb(null, true);
    } else {
        cb(new Error('Not a video! Please upload only videos.'), false);
    }
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB limit for actual transport
    },
    fileFilter: fileFilter
});

// All routes require seller access
router.use(verifyToken, allowRoles("seller"), requireApprovedSeller);

router.post("/check-intent", checkVideoUploadIntent);
router.post("/upload", upload.single('video'), uploadProductVideo);
router.get("/plans", getActivePlans);
router.post("/subscribe/create-order", createSubscriptionOrder);
router.post("/subscribe", subscribeToPlan);

export default router;
