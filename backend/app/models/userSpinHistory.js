import mongoose from "mongoose";

const userSpinHistorySchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        rewardId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "WheelReward",
            required: true,
        },
        scratchCardScratched: {
            type: Boolean,
            default: false,
        },
        rewardDetails: {
            label: String,
            rewardType: String,
            value: String,
            couponCode: String,
            cashbackCredited: {
                type: Boolean,
                default: false,
            },
            description: String,
            minOrderValue: Number,
            validityDays: Number,
        },
    },
    { timestamps: true }
);

// Compound index to quickly fetch user history by date
userSpinHistorySchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model("UserSpinHistory", userSpinHistorySchema);
