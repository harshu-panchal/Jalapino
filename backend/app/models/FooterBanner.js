import mongoose from "mongoose";

const footerBannerSchema = new mongoose.Schema(
  {
    imageUrl: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      trim: true,
    },
    link: {
      type: String,
      trim: true,
    },
    order: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  { timestamps: true }
);

footerBannerSchema.index({ status: 1, order: 1 });

export default mongoose.model("FooterBanner", footerBannerSchema);
