import WheelReward from "../models/wheelReward.js";
import UserSpinHistory from "../models/userSpinHistory.js";
import Coupon from "../models/coupon.js";
import { creditWallet } from "../services/finance/walletService.js";
import handleResponse from "../utils/helper.js";

// Helper to calculate start of today in local/server time
const getStartOfToday = () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return start;
};

// Customer: Get current wheel options and check if user has spun today
export const getWheelState = async (req, res) => {
    try {
        const userId = req.user.id;

        // Check if user has an unscratched spin
        const lastSpin = await UserSpinHistory.findOne({
            userId,
            scratchCardScratched: false,
        });

        // Get active rewards
        const activeRewards = await WheelReward.find({ isActive: true })
            .select("label rewardType bgColor textColor")
            .lean();

        return handleResponse(res, 200, "Wheel state fetched successfully", {
            hasSpunToday: !!lastSpin,
            lastSpin: lastSpin ? {
                id: lastSpin._id,
                rewardDetails: lastSpin.rewardDetails,
                scratchCardScratched: lastSpin.scratchCardScratched,
                createdAt: lastSpin.createdAt,
            } : null,
            wheelOptions: activeRewards,
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// Customer: Spin the wheel and determine reward (saves as a locked spin transaction)
export const spinWheel = async (req, res) => {
    try {
        const userId = req.user.id;

        // 1. Verify spin limits (block only if they have an unscratched spin)
        const existingSpin = await UserSpinHistory.findOne({
            userId,
            scratchCardScratched: false,
        });
        if (existingSpin) {
            return handleResponse(res, 400, "Please scratch your pending card before spinning again!");
        }

        // 2. Fetch active wheel slots
        const activeRewards = await WheelReward.find({ isActive: true });
        if (!activeRewards || activeRewards.length === 0) {
            return handleResponse(res, 404, "No active rewards configured on the wheel.");
        }

        // 3. Roll weighted probability
        const totalWeight = activeRewards.reduce((sum, r) => sum + (r.probability || 0), 0);
        if (totalWeight <= 0) {
            return handleResponse(res, 500, "Invalid probability weights configured.");
        }

        const randomRoll = Math.random() * totalWeight;
        let runningWeightSum = 0;
        let wonReward = null;

        for (const reward of activeRewards) {
            runningWeightSum += reward.probability;
            if (randomRoll <= runningWeightSum) {
                wonReward = reward;
                break;
            }
        }
        if (!wonReward) {
            wonReward = activeRewards[activeRewards.length - 1];
        }

        // 4. Formulate reward structure
        const rewardDetails = {
            label: wonReward.label,
            rewardType: wonReward.rewardType,
            value: wonReward.value || "",
            couponCode: "",
            cashbackCredited: false,
            description: wonReward.rewardType === "coupon"
                ? `Use code on checkout. Min order ₹${wonReward.minOrderValue || 200}. Valid for ${wonReward.validityDays || 7} days.`
                : `Won ₹${wonReward.value || 0} cashback.`,
            minOrderValue: wonReward.minOrderValue || 200,
            validityDays: wonReward.validityDays || 7,
        };

        // 5. If won a coupon, dynamically generate a valid Coupon in DB
        if (wonReward.rewardType === "coupon") {
            const discountPercent = Number(wonReward.value) || 10;
            const prefix = (wonReward.couponPrefix || "SPIN").trim().toUpperCase();
            const randomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
            const couponCode = `${prefix}${discountPercent}-${randomCode}`;

            const newCoupon = new Coupon({
                code: couponCode,
                title: `${discountPercent}% OFF Spin Wheel Reward`,
                description: `Get ${discountPercent}% discount from your Spin Wheel reward!`,
                discountType: "percentage",
                discountValue: discountPercent,
                minOrderValue: wonReward.minOrderValue || 200,
                validFrom: new Date(),
                validTill: new Date(Date.now() + (wonReward.validityDays || 7) * 24 * 60 * 60 * 1000), // Dynamic validity
                isActive: true,
                usageLimit: 1,
                perUserLimit: 1,
            });

            await newCoupon.save();
            rewardDetails.couponCode = couponCode;
        }

        // 6. Save Spin record
        // 6. Save Spin record (directly marked as scratched/claimed)
        const newSpin = new UserSpinHistory({
            userId,
            rewardId: wonReward._id,
            scratchCardScratched: true,
            rewardDetails,
        });

        // 7. If cashback, credit wallet instantly on spin
        if (wonReward.rewardType === "cashback") {
            const cashbackAmount = Number(wonReward.value) || 0;
            if (cashbackAmount > 0) {
                await creditWallet({
                    ownerType: "CUSTOMER",
                    ownerId: userId,
                    amount: cashbackAmount,
                    ledgerType: "ADJUSTMENT",
                    ledgerReference: `SPIN-CASH-${newSpin._id}`,
                    ledgerDescription: `Won ₹${cashbackAmount} from daily spin wheel.`,
                });
                newSpin.rewardDetails.cashbackCredited = true;
            }
        }

        await newSpin.save();

        return handleResponse(res, 201, "Spin completed successfully", {
            spinId: newSpin._id,
            rewardDetails: newSpin.rewardDetails,
            scratchCardScratched: newSpin.scratchCardScratched,
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// Customer: Scratch card callback to claim won reward (e.g. credit wallet if cashback)
export const scratchCard = async (req, res) => {
    try {
        const { spinId } = req.body;
        const userId = req.user.id;

        if (!spinId) {
            return handleResponse(res, 400, "spinId is required.");
        }

        // Atomically find and mark as scratched
        const spinHistory = await UserSpinHistory.findOneAndUpdate(
            { _id: spinId, userId, scratchCardScratched: false },
            { $set: { scratchCardScratched: true } },
            { new: true }
        );

        if (!spinHistory) {
            // Find the record to determine the exact error type
            const existing = await UserSpinHistory.findById(spinId);
            if (!existing) {
                return handleResponse(res, 404, "Spin history record not found.");
            }
            if (existing.userId.toString() !== userId) {
                return handleResponse(res, 403, "Access denied.");
            }
            if (existing.scratchCardScratched) {
                return handleResponse(res, 400, "This scratch card has already been scratched.");
            }
            return handleResponse(res, 404, "Spin history record not found.");
        }

        // If it was cashback, credit wallet instantly
        if (spinHistory.rewardDetails.rewardType === "cashback" && !spinHistory.rewardDetails.cashbackCredited) {
            const cashbackAmount = Number(spinHistory.rewardDetails.value) || 0;
            if (cashbackAmount > 0) {
                // Call canonical wallet credit service
                await creditWallet({
                    ownerType: "CUSTOMER",
                    ownerId: userId,
                    amount: cashbackAmount,
                    ledgerType: "ADJUSTMENT",
                    ledgerReference: `SPIN-CASH-${spinHistory._id}`,
                    ledgerDescription: `Won ₹${cashbackAmount} from daily spin wheel.`,
                });
                spinHistory.rewardDetails.cashbackCredited = true;
                await spinHistory.save();
            }
        }

        return handleResponse(res, 200, "Scratch card claimed successfully", {
            spinId: spinHistory._id,
            scratchCardScratched: spinHistory.scratchCardScratched,
            rewardDetails: spinHistory.rewardDetails,
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

/* ============================================================ */
/* ADMIN REWARDS MANAGEMENT (CRUD)                              */
/* ============================================================ */

// Admin: Get all rewards configurations
export const getRewards = async (req, res) => {
    try {
        const rewards = await WheelReward.find().sort({ createdAt: -1 });
        return handleResponse(res, 200, "Rewards configurations retrieved", rewards);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// Admin: Create a new reward option
export const createReward = async (req, res) => {
    try {
        const { label, rewardType, value, probability, bgColor, textColor, couponPrefix, minOrderValue, validityDays } = req.body;

        if (!label || !rewardType || probability === undefined) {
            return handleResponse(res, 400, "Label, rewardType, and probability weight are required.");
        }

        const newReward = new WheelReward({
            label,
            rewardType,
            value: value || "",
            probability: Number(probability) || 1,
            bgColor: bgColor || "#E11D48",
            textColor: textColor || "#FFFFFF",
            isActive: true,
            couponPrefix: couponPrefix !== undefined ? couponPrefix : "SPIN",
            minOrderValue: minOrderValue !== undefined ? Number(minOrderValue) : 200,
            validityDays: validityDays !== undefined ? Number(validityDays) : 7,
        });

        await newReward.save();
        return handleResponse(res, 201, "Reward configuration created successfully", newReward);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// Admin: Update a reward configuration
export const updateReward = async (req, res) => {
    try {
        const { id } = req.params;
        const { label, rewardType, value, probability, bgColor, textColor, isActive, couponPrefix, minOrderValue, validityDays } = req.body;

        const reward = await WheelReward.findById(id);
        if (!reward) {
            return handleResponse(res, 404, "Reward configuration not found.");
        }

        if (label !== undefined) reward.label = label;
        if (rewardType !== undefined) reward.rewardType = rewardType;
        if (value !== undefined) reward.value = value;
        if (probability !== undefined) reward.probability = Number(probability) || 0;
        if (bgColor !== undefined) reward.bgColor = bgColor;
        if (textColor !== undefined) reward.textColor = textColor;
        if (isActive !== undefined) reward.isActive = isActive;
        if (couponPrefix !== undefined) reward.couponPrefix = couponPrefix;
        if (minOrderValue !== undefined) reward.minOrderValue = minOrderValue === "" ? undefined : Number(minOrderValue);
        if (validityDays !== undefined) reward.validityDays = validityDays === "" ? undefined : Number(validityDays);

        await reward.save();
        return handleResponse(res, 200, "Reward configuration updated", reward);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// Admin: Delete a reward configuration
export const deleteReward = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await WheelReward.findByIdAndDelete(id);
        if (!deleted) {
            return handleResponse(res, 404, "Reward configuration not found.");
        }
        return handleResponse(res, 200, "Reward configuration deleted successfully");
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// Admin: Get statistics of gamification activities
export const getStats = async (req, res) => {
    try {
        const [totalSpins, couponSpins, cashbackSpins] = await Promise.all([
            UserSpinHistory.countDocuments(),
            UserSpinHistory.countDocuments({ "rewardDetails.rewardType": "coupon" }),
            UserSpinHistory.countDocuments({ "rewardDetails.rewardType": "cashback" }),
        ]);

        const totalCashbackCreditedAgg = await UserSpinHistory.aggregate([
            { $match: { "rewardDetails.rewardType": "cashback", "rewardDetails.cashbackCredited": true } },
            { $group: { _id: null, total: { $sum: { $toDouble: "$rewardDetails.value" } } } },
        ]);

        const totalCashbackCredited = totalCashbackCreditedAgg[0]?.total || 0;

        return handleResponse(res, 200, "Gamification stats calculated", {
            totalSpins,
            couponSpins,
            cashbackSpins,
            totalCashbackCredited,
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};
