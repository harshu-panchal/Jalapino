import express from "express";
import {
  createHsn,
  updateHsn,
  getAllHsns,
  getActiveHsns,
  deleteHsn
} from "../controller/hsnController.js";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public / Authenticated frontend fetch
router.get("/active", getActiveHsns);

// Admin only routes for CRUD
router.post("/", verifyToken, allowRoles("admin"), createHsn);
router.put("/:id", verifyToken, allowRoles("admin"), updateHsn);
router.delete("/:id", verifyToken, allowRoles("admin"), deleteHsn);
router.get("/admin", verifyToken, allowRoles("admin"), getAllHsns);

export default router;
