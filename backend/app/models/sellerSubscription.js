import mongoose from "mongoose";

const sellerSubscriptionSchema = new mongoose.Schema(
    {
        sellerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Seller",
            required: true,
        },
        planId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "VideoSubscriptionPlan",
            required: true,
        },
        billingCycle: {
            type: String,
            enum: ["monthly", "quarterly", "yearly"],
            required: true,
            default: "monthly",
        },
        amountPaid: {
            type: Number,
            default: 0,
        },
        paymentMethod: {
            type: String,
            enum: ["COD", "Razorpay"],
            default: "Razorpay",
        },
        paymentStatus: {
            type: String,
            enum: ["pending_cod", "paid", "failed"],
            default: "pending_cod",
        },
        razorpayOrderId: { type: String },
        razorpayPaymentId: { type: String },
        startDate: {
            type: Date,
            required: true,
            default: Date.now,
        },
        expiryDate: {
            type: Date,
            required: true,
        },
        includedStorageMB: {
            type: Number,
            required: true,
        },
        isActive: {
            type: Boolean,
            default: false, // becomes true only after payment confirmed
        }
    },
    { timestamps: true }
);

sellerSubscriptionSchema.index({ sellerId: 1, isActive: 1 });

export default mongoose.model("SellerSubscription", sellerSubscriptionSchema);

