import mongoose from "mongoose";

const serviceSchema = new mongoose.Schema(
    {
        sellerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Seller",
            required: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            trim: true,
        },
        category: {
            type: String,
            trim: true,
        },
        demoDays: {
            type: Number,
            default: 0,
        },
        subscriptionPlans: [{
            planType: { type: String, enum: ['Monthly', 'Quarterly', 'Yearly'] },
            price: { type: Number, required: true },
        }],
        timeSlots: [{
            type: String, // e.g., "09:00 AM - 10:00 AM"
            trim: true,
        }],
        availableDates: [{
            type: Date
        }],
        isActive: {
            type: Boolean,
            default: true,
        },
        status: {
            type: String,
            enum: ["active", "inactive"],
            default: "active",
        },
        approvalStatus: {
            type: String,
            enum: ["pending", "approved", "rejected"],
            default: "approved",
        },
    },
    { timestamps: true }
);

serviceSchema.index({ sellerId: 1, isActive: 1 });
serviceSchema.index({ category: 1, isActive: 1 });

export default mongoose.model("Service", serviceSchema);
