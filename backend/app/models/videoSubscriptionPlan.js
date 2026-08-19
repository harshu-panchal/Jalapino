import mongoose from "mongoose";

const videoSubscriptionPlanSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            trim: true,
        },
        // Pricing per billing cycle
        monthlyPrice: {
            type: Number,
            required: true,
            default: 0,
        },
        quarterlyPrice: {
            type: Number,
            required: true,
            default: 0,
        },
        yearlyPrice: {
            type: Number,
            required: true,
            default: 0,
        },
        // Free storage included in this plan
        includedStorageMB: {
            type: Number,
            required: true,
            default: 10,
        },
        // Price per extra MB beyond includedStorageMB
        extraMBPrice: {
            type: Number,
            required: true,
            default: 5,
        },
        isActive: {
            type: Boolean,
            default: true,
        }
    },
    { timestamps: true }
);

export default mongoose.model("VideoSubscriptionPlan", videoSubscriptionPlanSchema);

