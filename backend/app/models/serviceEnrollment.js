import mongoose from "mongoose";

const serviceEnrollmentSchema = new mongoose.Schema(
    {
        customerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Customer",
            required: true,
        },
        sellerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Seller",
            required: true,
        },
        serviceId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Service",
            required: true,
        },
        demoStartDate: {
            type: Date,
        },
        demoEndDate: {
            type: Date,
        },
        subscriptionPlan: {
            planType: { type: String, enum: ['Monthly', 'Quarterly', 'Yearly'] },
            price: { type: Number },
        },
        paymentStatus: {
            type: String,
            enum: ["pending", "completed", "failed", "refunded"],
            default: "pending",
        },
        subscriptionStatus: {
            type: String,
            enum: ["demo", "active", "expired", "cancelled"],
            default: "demo",
        },
        expiryDate: {
            type: Date,
        },
        paymentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Payment",
        }
    },
    { timestamps: true }
);

serviceEnrollmentSchema.index({ customerId: 1, serviceId: 1 });
serviceEnrollmentSchema.index({ sellerId: 1, subscriptionStatus: 1 });

export default mongoose.model("ServiceEnrollment", serviceEnrollmentSchema);
