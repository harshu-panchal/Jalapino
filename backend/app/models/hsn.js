import mongoose from "mongoose";

const hsnSchema = new mongoose.Schema(
    {
        hsnCode: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            uppercase: true,
        },
        description: {
            type: String,
            trim: true,
            default: "",
        },
        gstPercentage: {
            type: Number,
            required: true,
            min: 0,
            default: 0,
        },
        status: {
            type: String,
            enum: ["active", "inactive"],
            default: "active",
        },
    },
    { timestamps: true }
);

hsnSchema.index({ status: 1 });

export default mongoose.model("HSN", hsnSchema);
