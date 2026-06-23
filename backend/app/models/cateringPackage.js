import mongoose from "mongoose";

const cateringPackageSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        description: { type: String, trim: true, default: "" },
        price: { type: Number, required: true },
        guestCount: { type: Number, required: true },
        menuItems: { type: [String], default: [] },
        serviceType: { type: String, trim: true, default: "" },
        status: { type: String, enum: ["active", "inactive"], default: "active" },
        deletedAt: { type: Date, default: null },
    },
    { timestamps: true }
);

cateringPackageSchema.index({ status: 1 });
cateringPackageSchema.index({ deletedAt: 1 });

export default mongoose.model("CateringPackage", cateringPackageSchema);
