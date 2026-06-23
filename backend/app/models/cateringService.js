import mongoose from "mongoose";

const cateringServiceSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        description: { type: String, trim: true, default: "" },
        coverImage: { type: String, default: "" },
        galleryImages: { type: [String], default: [] },
        basePrice: { type: Number, default: 0 },
        maxCapacity: { type: Number, default: 0 },
        status: { type: String, enum: ["active", "inactive"], default: "active" },
        deletedAt: { type: Date, default: null },
    },
    { timestamps: true }
);

cateringServiceSchema.index({ status: 1 });
cateringServiceSchema.index({ deletedAt: 1 });

export default mongoose.model("CateringService", cateringServiceSchema);
