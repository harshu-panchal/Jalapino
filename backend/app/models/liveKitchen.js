import mongoose from "mongoose";

const liveKitchenSchema = new mongoose.Schema(
    {
        sellerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Seller",
            required: true,
        },
        orderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
            default: null, // Optional: if stream/updates are for a specific order
        },
        streamUrl: {
            type: String,
            trim: true,
            default: "", // E.g., YouTube Live, WebRTC URL
        },
        cookingStatus: {
            type: String,
            enum: ["Preparing Ingredients", "Cooking", "Packing", "Ready", "Offline", ""],
            default: "Offline",
        },
        photoUpdates: [
            {
                imageUrl: { type: String, required: true },
                description: { type: String, default: "" },
                timestamp: { type: Date, default: Date.now },
            }
        ],
        isCustomerVisible: {
            type: Boolean,
            default: true,
        },
        isActive: {
            type: Boolean,
            default: true,
        }
    },
    { timestamps: true }
);

// Optimize performance for lookups
liveKitchenSchema.index({ sellerId: 1, isActive: 1 });
liveKitchenSchema.index({ orderId: 1 });

export default mongoose.model("LiveKitchen", liveKitchenSchema);
