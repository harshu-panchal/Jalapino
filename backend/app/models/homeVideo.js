import mongoose from "mongoose";

const homeVideoSchema = new mongoose.Schema(
  {
    videoUrl: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      trim: true,
    },
    subtitle: {
      type: String,
      trim: true,
    },
    linkType: {
      type: String,
      enum: ["none", "product", "category", "url"],
      default: "none",
    },
    linkValue: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

export default mongoose.model("HomeVideo", homeVideoSchema);
