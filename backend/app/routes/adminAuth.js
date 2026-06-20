import express from "express";
import {
    bootstrapAdmin,
    signupAdmin,
    loginAdmin,
} from "../controller/adminAuthController.js";
import {
    getAdminProfile,
    updateAdminProfile,
    updateAdminPassword,
    getAdminStats,
    getDeliveryPartners,
    approveDeliveryPartner,
    rejectDeliveryPartner,
    getActiveFleet,
    getAdminWalletData,
    getDeliveryTransactions,
    settleTransaction,
    bulkSettleDelivery,
    getActiveSellers,
    getPendingSellers,
    approveSellerApplication,
    rejectSellerApplication,
    getSellerWithdrawals,
    getDeliveryWithdrawals,
    updateWithdrawalStatus,
    getSellerTransactions,
    getDeliveryCashBalances,
    getRiderCashDetails,
    settleRiderCash,
    getCashSettlementHistory,
    getUsers,
    getUserById,
    getSellers,
    getSellerLocations,
    getPlatformSettings,
    updatePlatformSettings,
    getAllAdmins,
    createAdmin,
    updateAdminRole,
    deleteAdmin
} from "../controller/adminController.js";
import {
    exportAdminFinanceStatementController,
    getAdminFinanceLedgerController,
    getAdminFinancePayoutsController,
    getAdminFinanceSummaryController,
    getDeliverySettingsController,
    processAdminFinancePayoutsController,
    updateDeliverySettingsController,
} from "../controller/adminFinanceController.js";

import { verifyToken, allowRoles, requireAdminRole } from "../middleware/authMiddleware.js";
import {
    adminBootstrapRateLimiter,
    authRouteRateLimiter,
    createContentLengthGuard,
} from "../middleware/securityMiddlewares.js";

const router = express.Router();

const smallAdminPayload = createContentLengthGuard(
    parseInt(process.env.ADMIN_AUTH_MAX_PAYLOAD_BYTES || "20480", 10),
    "Admin auth payload too large",
);
router.post("/bootstrap", adminBootstrapRateLimiter, smallAdminPayload, bootstrapAdmin);
router.post("/signup", adminBootstrapRateLimiter, smallAdminPayload, signupAdmin);
router.post("/login", authRouteRateLimiter, smallAdminPayload, loginAdmin);

// Admin Management routes
router.get(
    "/admins",
    verifyToken,
    allowRoles("admin"),
    requireAdminRole("super_admin"),
    getAllAdmins
);
router.post(
    "/admins",
    verifyToken,
    allowRoles("admin"),
    requireAdminRole("super_admin"),
    createAdmin
);
router.put(
    "/admins/:id",
    verifyToken,
    allowRoles("admin"),
    requireAdminRole("super_admin"),
    updateAdminRole
);
router.delete(
    "/admins/:id",
    verifyToken,
    allowRoles("admin"),
    requireAdminRole("super_admin"),
    deleteAdmin
);

// Profile routes
router.get(
    "/profile",
    verifyToken,
    allowRoles("admin"),
    getAdminProfile
);

router.put(
    "/profile",
    verifyToken,
    allowRoles("admin"),
    updateAdminProfile
);

router.put(
    "/profile/password",
    verifyToken,
    allowRoles("admin"),
    updateAdminPassword
);

router.get(
    "/stats",
    verifyToken,
    allowRoles("admin"),
    getAdminStats
);
router.get(
    "/finance/summary",
    verifyToken,
    allowRoles("admin"),
    requireAdminRole("super_admin", "finance"),
    getAdminFinanceSummaryController,
);
router.get(
    "/finance/ledger",
    verifyToken,
    allowRoles("admin"),
    requireAdminRole("super_admin", "finance"),
    getAdminFinanceLedgerController,
);
router.get(
    "/finance/payouts",
    verifyToken,
    allowRoles("admin"),
    requireAdminRole("super_admin", "finance"),
    getAdminFinancePayoutsController,
);
router.post(
    "/finance/payouts/process",
    verifyToken,
    allowRoles("admin"),
    requireAdminRole("super_admin", "finance"),
    processAdminFinancePayoutsController,
);
router.get(
    "/finance/export-statement",
    verifyToken,
    allowRoles("admin"),
    requireAdminRole("super_admin", "finance"),
    exportAdminFinanceStatementController,
);
router.get(
    "/settings/platform",
    verifyToken,
    allowRoles("admin"),
    requireAdminRole("super_admin"),
    getPlatformSettings
);
router.get(
    "/settings/delivery",
    verifyToken,
    allowRoles("admin"),
    requireAdminRole("super_admin"),
    getDeliverySettingsController,
);
router.put(
    "/settings/delivery",
    verifyToken,
    allowRoles("admin"),
    requireAdminRole("super_admin"),
    updateDeliverySettingsController,
);
router.put(
    "/settings/platform",
    verifyToken,
    allowRoles("admin"),
    requireAdminRole("super_admin"),
    updatePlatformSettings
);
router.get("/users", verifyToken, allowRoles("admin"), requireAdminRole("super_admin", "sub_admin"), getUsers);
router.get("/users/:id", verifyToken, allowRoles("admin"), requireAdminRole("super_admin", "sub_admin"), getUserById);
router.get("/sellers", verifyToken, allowRoles("admin"), requireAdminRole("super_admin", "sub_admin"), getSellers);
router.get("/sellers/locations", verifyToken, allowRoles("admin"), requireAdminRole("super_admin", "sub_admin"), getSellerLocations);
router.get("/sellers/active", verifyToken, allowRoles("admin"), requireAdminRole("super_admin", "sub_admin"), getActiveSellers);
router.get("/sellers/pending", verifyToken, allowRoles("admin"), requireAdminRole("super_admin", "sub_admin"), getPendingSellers);
router.patch("/sellers/approve/:id", verifyToken, allowRoles("admin"), requireAdminRole("super_admin", "sub_admin"), approveSellerApplication);
router.delete("/sellers/reject/:id", verifyToken, allowRoles("admin"), requireAdminRole("super_admin", "sub_admin"), rejectSellerApplication);

router.get(
    "/delivery-partners",
    verifyToken,
    allowRoles("admin"),
    requireAdminRole("super_admin", "sub_admin"),
    getDeliveryPartners
);

router.patch(
    "/delivery-partners/approve/:id",
    verifyToken,
    allowRoles("admin"),
    requireAdminRole("super_admin", "sub_admin"),
    approveDeliveryPartner
);

router.delete(
    "/delivery-partners/reject/:id",
    verifyToken,
    allowRoles("admin"),
    requireAdminRole("super_admin", "sub_admin"),
    rejectDeliveryPartner
);

router.get("/active-fleet", verifyToken, allowRoles("admin"), requireAdminRole("super_admin", "sub_admin"), getActiveFleet);
router.get("/wallet-data", verifyToken, allowRoles("admin"), requireAdminRole("super_admin", "finance"), getAdminWalletData);

// Delivery Payouts / Funds
router.get("/delivery-transactions", verifyToken, allowRoles('admin'), requireAdminRole("super_admin", "finance"), getDeliveryTransactions);
router.put("/transactions/:id/settle", verifyToken, allowRoles("admin"), requireAdminRole("super_admin", "finance"), settleTransaction);
router.put("/transactions/bulk-settle-delivery", verifyToken, allowRoles("admin"), requireAdminRole("super_admin", "finance"), bulkSettleDelivery);

// Cash Collection Hub
router.get("/delivery-cash", verifyToken, allowRoles("admin"), requireAdminRole("super_admin", "finance"), getDeliveryCashBalances);
router.get("/rider-cash-details/:id", verifyToken, allowRoles("admin"), requireAdminRole("super_admin", "finance"), getRiderCashDetails);
router.post("/settle-cash", verifyToken, allowRoles("admin"), requireAdminRole("super_admin", "finance"), settleRiderCash);
router.get("/cash-history", verifyToken, allowRoles("admin"), requireAdminRole("super_admin", "finance"), getCashSettlementHistory);

// Seller Withdrawal Management
router.get("/seller-withdrawals", verifyToken, allowRoles("admin"), requireAdminRole("super_admin", "finance"), getSellerWithdrawals);
router.get("/delivery-withdrawals", verifyToken, allowRoles("admin"), requireAdminRole("super_admin", "finance"), getDeliveryWithdrawals);
router.get("/seller-transactions", verifyToken, allowRoles("admin"), requireAdminRole("super_admin", "finance"), getSellerTransactions);
router.put("/withdrawals/:id", verifyToken, allowRoles("admin"), requireAdminRole("super_admin", "finance"), updateWithdrawalStatus);

// Protected admin route example
router.get(
    "/dashboard",
    verifyToken,
    allowRoles("admin"),
    (req, res) => {
        res.json({
            success: true,
            message: "Welcome to Admin Dashboard",
        });
    }
);

export default router;
