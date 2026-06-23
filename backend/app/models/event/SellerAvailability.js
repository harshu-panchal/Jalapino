import mongoose from "mongoose";

const sellerAvailabilitySchema = new mongoose.Schema(
  {
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seller",
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    availableSlots: [{
      start: String, // e.g., "09:00"
      end: String,   // e.g., "12:00"
    }],
    blockedSlots: [{
      start: String,
      end: String,
      reason: String,
    }],
    holidayFlag: {
      type: Boolean,
      default: false,
    },
    maxCapacity: {
      type: Number,
      default: 0,
    },
    currentBookedCapacity: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Compound index for fast querying by seller and date
sellerAvailabilitySchema.index({ sellerId: 1, date: 1 }, { unique: true });

export default mongoose.model("SellerAvailability", sellerAvailabilitySchema);
