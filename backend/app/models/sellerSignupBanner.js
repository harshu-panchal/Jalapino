import mongoose from "mongoose";

const sellerSignupBannerSchema = new mongoose.Schema(
  {
    imageUrl: {
      type: String,
      required: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    width: {
      type: String,
      default: '100%',
    },
    height: {
      type: String,
      default: '100%',
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("SellerSignupBanner", sellerSignupBannerSchema);
