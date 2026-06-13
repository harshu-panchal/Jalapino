import Referral from "../models/referral.js";
import Setting from "../models/setting.js";
import Coupon from "../models/coupon.js";
import { creditWallet } from "./finance/walletService.js";

/**
 * Process and distribute rewards for a referral event.
 * Handles both Cashback credits and Discount Coupon generation.
 * @param {string} referralId - Mongoose Referral document ID
 */
export async function processReferralRewards(referralId) {
    try {
        const referral = await Referral.findById(referralId);
        if (!referral || referral.status === "completed") {
            return;
        }

        const settings = await Setting.findOne();
        if (!settings || !settings.referralProgram || !settings.referralProgram.isEnabled) {
            return;
        }

        const program = settings.referralProgram;
        const rewardType = program.rewardType || "cashback";

        // 1. Process Referrer Reward
        if (!referral.referrerRewardClaimed && program.referrerReward > 0) {
            if (rewardType === "cashback") {
                await creditWallet({
                    ownerType: "CUSTOMER",
                    ownerId: referral.referrerId,
                    amount: Number(program.referrerReward),
                    ledgerType: "ADJUSTMENT",
                    ledgerReference: `REF-BONUS-${referral._id}`,
                    ledgerDescription: `Referral bonus for inviting user (referee ID: ${referral.refereeId}).`,
                });
            } else if (rewardType === "coupon") {
                const discountVal = Number(program.referrerReward);
                const randomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
                const code = `REF-INV-${discountVal}-${randomCode}`;

                const referrerCoupon = new Coupon({
                    code,
                    title: `Referral Bonus: Invite Reward`,
                    description: `Get ₹${discountVal} flat discount for referring your friend!`,
                    discountType: "flat",
                    discountValue: discountVal,
                    minOrderValue: program.minOrderValue || 100,
                    validFrom: new Date(),
                    validTill: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days valid
                    isActive: true,
                    usageLimit: 1,
                    perUserLimit: 1,
                });
                await referrerCoupon.save();
            }
            referral.referrerRewardClaimed = true;
        }

        // 2. Process Referee Reward
        if (!referral.refereeRewardClaimed && program.refereeReward > 0) {
            if (rewardType === "cashback") {
                await creditWallet({
                    ownerType: "CUSTOMER",
                    ownerId: referral.refereeId,
                    amount: Number(program.refereeReward),
                    ledgerType: "ADJUSTMENT",
                    ledgerReference: `REF-BONUS-${referral._id}`,
                    ledgerDescription: `Referral bonus for signing up via inviter (referrer ID: ${referral.referrerId}).`,
                });
            } else if (rewardType === "coupon") {
                const discountVal = Number(program.refereeReward);
                const randomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
                const code = `REF-JOIN-${discountVal}-${randomCode}`;

                const refereeCoupon = new Coupon({
                    code,
                    title: `Referral Bonus: Welcome Reward`,
                    description: `Get ₹${discountVal} flat discount on your first order!`,
                    discountType: "flat",
                    discountValue: discountVal,
                    minOrderValue: program.minOrderValue || 100,
                    validFrom: new Date(),
                    validTill: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days valid
                    isActive: true,
                    usageLimit: 1,
                    perUserLimit: 1,
                });
                await refereeCoupon.save();
            }
            referral.refereeRewardClaimed = true;
        }

        referral.status = "completed";
        await referral.save();
        
        console.log(`Referral rewards processed successfully for ID: ${referralId}`);
    } catch (error) {
        console.error(`Error processing referral rewards for ID: ${referralId}:`, error);
        throw error;
    }
}
