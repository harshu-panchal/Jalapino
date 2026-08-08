import mongoose from 'mongoose';

const memberTicketSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GeneralBooking',
      required: true,
      index: true,
    },
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
    memberName: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ['Adult', 'Child'],
      required: true,
    },
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other'],
      required: true,
    },
    age: {
      type: Number,
      required: true,
    },
    mobileNumber: {
      type: String,
      required: true,
      trim: true,
    },
    ticketId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    secureQrToken: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['Pending', 'Confirmed', 'Checked-In', 'Completed', 'Cancelled', 'Invalid'],
      default: 'Pending',
      index: true,
    },
    scannedAt: {
      type: Date,
      default: null,
    }
  },
  {
    timestamps: true,
  }
);

const MemberTicket = mongoose.model('MemberTicket', memberTicketSchema);
export default MemberTicket;
