import Customer from "../models/customer.js";
import Referral from "../models/referral.js";
import Setting from "../models/setting.js";
import LedgerEntry from "../models/ledgerEntry.js";
import crypto from "crypto";
import handleResponse from "../utils/helper.js";
import { invalidate } from "../services/cacheService.js";

// Helper to generate unique code if missing
async function generateReferralCode(name) {
    const sanitized = String(name || "JAL")
        .replace(/[^a-zA-Z]/g, "")
        .substring(0, 5)
        .toUpperCase();
    
    let attempts = 0;
    while (attempts < 10) {
        const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
        const code = `JAL-${sanitized}-${rand}`;
        const existing = await Customer.findOne({ referralCode: code });
        if (!existing) {
            return code;
        }
        attempts++;
    }
    return `JAL-${Date.now().toString(36).toUpperCase()}`;
}

// Customer: Get personal referral stats, invite code, link, and list of referred friends
export const getCustomerReferralDetails = async (req, res) => {
    try {
        const customerId = req.user.id;
        
        let customer = await Customer.findById(customerId);
        if (!customer) {
            return handleResponse(res, 404, "Customer not found");
        }

        // Auto-generate code if missing
        if (!customer.referralCode) {
            customer.referralCode = await generateReferralCode(customer.name);
            await customer.save();
        }

        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        const referralLink = `${frontendUrl}/register?ref=${customer.referralCode}`;

        // Get referred users list
        const referrals = await Referral.find({ referrerId: customerId })
            .populate("refereeId", "name phone isVerified createdAt")
            .sort({ createdAt: -1 })
            .lean();

        // Get active settings
        const settings = await Setting.findOne();
        const campaignRules = settings?.referralProgram || {
            isEnabled: false,
            rewardType: "cashback",
            referrerReward: 50,
            refereeReward: 20,
            eligibilityCondition: "first_order_delivered",
            minOrderValue: 100,
        };

        const referralsList = referrals.map(r => ({
            id: r._id,
            refereeName: r.refereeId?.name || "Invited Friend",
            refereePhone: r.refereeId?.phone ? `XXXXXX${r.refereeId.phone.slice(-4)}` : "N/A",
            isVerified: r.refereeId?.isVerified || false,
            status: r.status,
            createdAt: r.createdAt,
            referrerRewardClaimed: r.referrerRewardClaimed,
        }));

        const totalEarnedAgg = await LedgerEntry.aggregate([
            { 
                $match: { 
                    actorId: customer._id,
                    reference: { $regex: /^REF-BONUS-/ }
                } 
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$amount" }
                }
            }
        ]);
        const totalEarnedCashback = totalEarnedAgg[0]?.total || 0;

        return handleResponse(res, 200, "Referral details retrieved successfully", {
            referralCode: customer.referralCode,
            referralLink,
            referralCount: customer.referralCount || referrals.length,
            completedCount: referrals.filter(r => r.status === "completed").length,
            totalEarnedCashback,
            referralsList,
            campaignRules,
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// Admin: Get referral program configuration
export const getAdminReferralConfig = async (req, res) => {
    try {
        const settings = await Setting.findOne();
        const config = settings?.referralProgram || {
            isEnabled: false,
            rewardType: "cashback",
            referrerReward: 50,
            refereeReward: 20,
            eligibilityCondition: "first_order_delivered",
            minOrderValue: 100,
        };
        return handleResponse(res, 200, "Referral settings configuration retrieved", config);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// Admin: Update referral program rules
export const updateAdminReferralConfig = async (req, res) => {
    try {
        const {
            isEnabled,
            rewardType,
            referrerReward,
            refereeReward,
            eligibilityCondition,
            minOrderValue,
        } = req.body;

        let settings = await Setting.findOne();
        if (!settings) {
            settings = new Setting();
        }

        settings.referralProgram = {
            isEnabled: isEnabled !== undefined ? !!isEnabled : settings.referralProgram?.isEnabled,
            rewardType: rewardType || settings.referralProgram?.rewardType || "cashback",
            referrerReward: referrerReward !== undefined ? Number(referrerReward) : settings.referralProgram?.referrerReward,
            refereeReward: refereeReward !== undefined ? Number(refereeReward) : settings.referralProgram?.refereeReward,
            eligibilityCondition: eligibilityCondition || settings.referralProgram?.eligibilityCondition || "first_order_delivered",
            minOrderValue: minOrderValue !== undefined ? Number(minOrderValue) : settings.referralProgram?.minOrderValue,
        };

        await settings.save();
        await invalidate("cache:platform:settings:*");
        return handleResponse(res, 200, "Referral settings updated successfully", settings.referralProgram);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// Admin: Get analytics/stats for referral program
export const getAdminReferralStats = async (req, res) => {
    try {
        const [totalReferrals, completedReferrals, pendingReferrals] = await Promise.all([
            Referral.countDocuments(),
            Referral.countDocuments({ status: "completed" }),
            Referral.countDocuments({ status: "pending" }),
        ]);

        // Calculate total cashback paid out in referrals
        const totalPayoutAgg = await LedgerEntry.aggregate([
            { 
                $match: { 
                    reference: { $regex: /^REF-BONUS-/ }
                } 
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$amount" }
                }
            }
        ]);
        const totalPayoutPaid = totalPayoutAgg[0]?.total || 0;

        return handleResponse(res, 200, "Referral metrics calculated", {
            totalReferrals,
            completedReferrals,
            pendingReferrals,
            totalPayoutPaid,
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};
