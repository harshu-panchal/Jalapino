import mongoose from "mongoose";

const sellerReservationSchema = new mongoose.Schema(
  {
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seller",
      required: true,
      index: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EventBooking", // Assuming this will be created later, or we can use String for now
    },
    reservationStartTime: {
      type: Date,
      required: true,
    },
    reservationExpiryTime: {
      type: Date,
      required: true,
      index: true, // Useful for cleanup jobs
    },
    status: {
      type: String,
      enum: ["active", "expired", "confirmed"],
      default: "active",
    },
  },
  { timestamps: true }
);

export default mongoose.model("SellerReservation", sellerReservationSchema);
