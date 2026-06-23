import express from "express";
import { searchEventSellers } from "../controller/eventSellerController.js";

const router = express.Router();

router.get("/search", searchEventSellers);

export default router;
