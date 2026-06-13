import mongoose from "mongoose";

const wheelRewardSchema = new mongoose.Schema(
    {
        label: {
            type: String,
            required: true,
            trim: true,
        },
        rewardType: {
            type: String,
            enum: ["coupon", "cashback", "try_again"],
            required: true,
        },
        value: {
            type: String, // Value for discount (e.g. "10" for 10% percentage discount, or "50" for cashback amount)
            default: "",
        },
        probability: {
            type: Number, // Selection probability weight
            required: true,
            default: 10,
        },
        bgColor: {
            type: String,
            default: "#E11D48", // Rose-600 default
        },
        textColor: {
            type: String,
            default: "#FFFFFF",
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        // Dynamic Coupon configurations controlled by Admin
        couponPrefix: {
            type: String,
            default: "SPIN",
            trim: true,
        },
        minOrderValue: {
            type: Number,
            default: 200,
        },
        validityDays: {
            type: Number,
            default: 7,
        },
    },
    { timestamps: true }
);

export default mongoose.model("WheelReward", wheelRewardSchema);
