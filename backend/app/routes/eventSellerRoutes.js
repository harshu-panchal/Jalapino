import express from "express";
import { searchEventSellers, getSellerPackagesPublic, getAreaSellers } from "../controller/eventSellerController.js";

const router = express.Router();

router.get("/area", getAreaSellers);
router.get("/search", searchEventSellers);
router.get("/:sellerId/packages", getSellerPackagesPublic);

export default router;
