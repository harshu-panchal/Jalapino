import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { updateStreamUrl, addPhotoUpdate, getLiveKitchenStatus, getPublicLiveStreams, toggleStreamLike, uploadStreamVideo } from "../controller/liveKitchenController.js";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";

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
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    fileFilter: function (req, file, cb) {
        if (!file.mimetype.startsWith('video/')) {
            return cb(new Error('Not a video! Please upload only videos.'), false);
        }
        cb(null, true);
    },
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

// Public routes (Customers)
router.get("/public/streams", getPublicLiveStreams);
router.get("/:sellerId", getLiveKitchenStatus);
router.get("/:sellerId/:orderId", getLiveKitchenStatus);

// Private routes (Customers)
router.post("/streams/:id/like", verifyToken, allowRoles("customer"), toggleStreamLike);

// Private routes (Sellers)
router.post("/stream", verifyToken, allowRoles("seller"), updateStreamUrl);
router.post("/stream/upload", verifyToken, allowRoles("seller"), upload.single('video'), uploadStreamVideo);
router.post("/photo", verifyToken, allowRoles("seller"), addPhotoUpdate);

export default router;
