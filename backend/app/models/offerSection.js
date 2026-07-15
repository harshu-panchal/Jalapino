import mongoose from "mongoose";

const offerSectionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    backgroundColor: {
      type: String,
      trim: true,
      default: "#FCD34D",
    },
    sideImageKey: {
      type: String,
      default: "hair-care",
    },
    customImageUrls: {
      type: [String],
      default: [],
    },
    categoryIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category" }, // legacy single category
    sellerIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Seller" }],
    productIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
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

offerSectionSchema.index({ status: 1, order: 1, createdAt: 1 });

export default mongoose.model("OfferSection", offerSectionSchema);
