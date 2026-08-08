import mongoose from 'mongoose';

const generalBookingSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Seller',
      required: true,
      index: true,
    },
    venueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      index: true,
    },
    bookingType: {
      type: String,
      enum: ['Family', 'Group', 'Corporate', 'School', 'Others'],
      required: true,
    },
    bookingDate: {
      type: Date,
      required: true,
      index: true,
    },
    timeSlot: {
      type: String,
      required: true,
    },
    totalMembers: {
      type: Number,
      required: true,
      min: 1,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentMethod: {
      type: String,
      enum: ['COD', 'Razorpay', 'Physical'],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ['Pending', 'Paid', 'Failed', 'Refunded'],
      default: 'Pending',
      index: true,
    },
    bookingStatus: {
      type: String,
      enum: ['Pending', 'Confirmed', 'Cancelled', 'Completed'],
      default: 'Pending',
      index: true,
    },
    razorpayOrderId: {
      type: String,
      trim: true,
    },
    razorpayPaymentId: {
      type: String,
      trim: true,
    },
    addons: [{
      name: { type: String, required: true },
      price: { type: Number, required: true },
      status: { type: String, enum: ['Pending', 'Completed'], default: 'Pending' },
      rating: { type: Number, default: 0 },
      review: { type: String, default: "" }
    }]
  },
  {
    timestamps: true,
  }
);

const GeneralBooking = mongoose.model('GeneralBooking', generalBookingSchema);
export default GeneralBooking;
