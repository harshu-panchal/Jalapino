import mongoose from 'mongoose';

const bookingManagementSchema = new mongoose.Schema(
  {
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Seller',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['online', 'offline'],
      default: 'offline',
    },
    customerName: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    mobileNumber: {
      type: String,
      required: true,
      trim: true,
    },
    bookingDate: {
      type: Date,
      required: true,
      index: true,
    },
    timeSlot: {
      type: String,
      enum: ['2 Hours', '4 Hours', '24 Hours'],
      required: true,
    },
    bookingStatus: {
      type: String,
      enum: ['Marked', 'Booked', 'Enquiry Only', 'Cancelled'],
      default: 'Enquiry Only',
      index: true,
    },
    guestsCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    paymentEntryDate: {
      type: Date,
    },
    advancePaymentAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    totalBookingAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    totalPaidAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    paymentDueAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    remarks: {
      type: String,
      trim: true,
    },
    physicalVisitRequired: {
      type: Boolean,
      default: false,
    },
    physicalVisitStatus: {
      type: String,
      enum: ['None', 'Requested', 'Confirmed', 'Completed'],
      default: 'None',
    },
    sellerRatingByCustomer: {
      type: Number,
      min: 1,
      max: 5,
    },
    sellerReviewByCustomer: {
      type: String,
      trim: true,
    },
    customerRatingBySeller: {
      type: Number,
      min: 1,
      max: 5,
    },
    customerReviewBySeller: {
      type: String,
      trim: true,
    },
    cancellationDate: {
      type: Date,
    },
    refundAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook to auto calculate Payment Due Amount
bookingManagementSchema.pre('save', function (next) {
  this.paymentDueAmount = Math.max(0, this.totalBookingAmount - this.totalPaidAmount);
  next();
});

// Pre-findOneAndUpdate hook to auto calculate Payment Due Amount on update
bookingManagementSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate();
  if (update.$set) {
    const total = update.$set.totalBookingAmount !== undefined ? update.$set.totalBookingAmount : null;
    const paid = update.$set.totalPaidAmount !== undefined ? update.$set.totalPaidAmount : null;
    if (total !== null || paid !== null) {
      // We will handle this in the controller as mongoose pre-findOneAndUpdate can be complex for dynamic values.
    }
  }
  next();
});

const BookingManagement = mongoose.model('BookingManagement', bookingManagementSchema);

export default BookingManagement;
