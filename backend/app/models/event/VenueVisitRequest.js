import mongoose from 'mongoose';

const venueVisitRequestSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true,
    },
    venueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Seller',
      required: true,
      index: true,
    },
    preferredDate: {
      type: Date,
      required: true,
    },
    preferredTimeSlot: {
      type: String,
      required: true,
    },
    guestCount: {
      type: Number,
      required: true,
    },
    eventType: {
      type: String,
      required: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['Requested', 'Accepted', 'Rescheduled', 'Confirmed', 'Completed', 'Cancelled', 'Rejected'],
      default: 'Requested',
      index: true,
    },
    rescheduledDetails: {
      date: Date,
      timeSlot: String,
      proposedBy: {
        type: String,
        enum: ['seller', 'customer'],
      }
    }
  },
  {
    timestamps: true,
  }
);

const VenueVisitRequest = mongoose.model('VenueVisitRequest', venueVisitRequestSchema);
export default VenueVisitRequest;
