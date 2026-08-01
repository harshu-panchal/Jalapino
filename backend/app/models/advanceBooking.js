import mongoose from 'mongoose';

const advanceBookingSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Seller',
      required: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
    },
    productCode: {
      type: String,
      trim: true,
    },
    bookingDate: {
      type: Date,
      default: Date.now,
    },
    deliveryDate: {
      type: Date,
      required: true,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    advanceAmountPaid: {
      type: Number,
      default: 0,
      min: 0,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'partial', 'paid'],
      default: 'pending',
    },
    bookingStatus: {
      type: String,
      enum: [
        'pending',
        'accepted',
        'decoration_complete',
        'customer_confirmed',
        'completed',
        'cancelled',
      ],
      default: 'pending',
    },
    specialInstructions: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for faster querying
advanceBookingSchema.index({ sellerId: 1, bookingStatus: 1 });
advanceBookingSchema.index({ customerId: 1, bookingStatus: 1 });
advanceBookingSchema.index({ deliveryDate: 1 });

const AdvanceBooking = mongoose.model('AdvanceBooking', advanceBookingSchema);

export default AdvanceBooking;
