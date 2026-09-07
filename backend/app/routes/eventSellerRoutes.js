import express from "express";
import { searchEventSellers, getSellerPackagesPublic, getAreaSellers, getSellerBookedDates } from "../controller/eventSellerController.js";

const router = express.Router();

router.get("/area", getAreaSellers);
router.get("/search", searchEventSellers);
router.get("/:sellerId/booked-dates", getSellerBookedDates);
router.get("/:sellerId/packages", getSellerPackagesPublic);

export default router;
