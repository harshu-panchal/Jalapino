import express from "express";
import { searchEventSellers, getSellerPackagesPublic } from "../controller/eventSellerController.js";

const router = express.Router();

router.get("/search", searchEventSellers);
router.get("/:sellerId/packages", getSellerPackagesPublic);

export default router;
