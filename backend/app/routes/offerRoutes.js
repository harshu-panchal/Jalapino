import express from "express";
import {
  getPublicOffers,
  getAdminOffers,
  createOffer,
  updateOffer,
  deleteOffer,
  reorderOffers,
} from "../controller/offerController.js";
import {
  getPublicOfferSections,
  getAdminOfferSections,
  createOfferSection,
  updateOfferSection,
  deleteOfferSection,
  reorderOfferSections,
} from "../controller/offerSectionController.js";
import { verifyToken, allowRoles, requireAdminRole } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/offers", getPublicOffers);
router.get("/offer-sections", getPublicOfferSections);

router.get(
  "/admin-offers",
  verifyToken,
  allowRoles("admin"),
  requireAdminRole("super_admin", "marketing"),
  getAdminOffers,
);

router.post(
  "/admin-offers",
  verifyToken,
  allowRoles("admin"),
  requireAdminRole("super_admin", "marketing"),
  createOffer,
);

router.put(
  "/admin-offers/reorder",
  verifyToken,
  allowRoles("admin"),
  requireAdminRole("super_admin", "marketing"),
  reorderOffers,
);

router.put(
  "/admin-offers/:id",
  verifyToken,
  allowRoles("admin"),
  requireAdminRole("super_admin", "marketing"),
  updateOffer,
);

router.delete(
  "/admin-offers/:id",
  verifyToken,
  allowRoles("admin"),
  requireAdminRole("super_admin", "marketing"),
  deleteOffer,
);

router.get(
  "/admin-offer-sections",
  verifyToken,
  allowRoles("admin"),
  requireAdminRole("super_admin", "marketing"),
  getAdminOfferSections,
);
router.post(
  "/admin-offer-sections",
  verifyToken,
  allowRoles("admin"),
  requireAdminRole("super_admin", "marketing"),
  createOfferSection,
);
router.put(
  "/admin-offer-sections/reorder",
  verifyToken,
  allowRoles("admin"),
  requireAdminRole("super_admin", "marketing"),
  reorderOfferSections,
);
router.put(
  "/admin-offer-sections/:id",
  verifyToken,
  allowRoles("admin"),
  requireAdminRole("super_admin", "marketing"),
  updateOfferSection,
);
router.delete(
  "/admin-offer-sections/:id",
  verifyToken,
  allowRoles("admin"),
  requireAdminRole("super_admin", "marketing"),
  deleteOfferSection,
);

export default router;

