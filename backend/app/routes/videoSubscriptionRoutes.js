import express from "express";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";
import {
    createPlan,
    getPlans,
    updatePlan,
    deletePlan,
    getSubscriptions,
    confirmCODSubscription,
} from "../controller/admin/videoSubscriptionController.js";

const router = express.Router();

// All routes here should be protected by admin role
router.use(verifyToken, allowRoles("admin"));

router.post("/", createPlan);
router.get("/", getPlans);
router.get("/subscriptions", getSubscriptions);
router.patch("/subscriptions/:id/confirm-cod", confirmCODSubscription);
router.put("/:id", updatePlan);
router.delete("/:id", deletePlan);

export default router;

