import mongoose from 'mongoose';

const sellerVenueAvailabilitySchema = new mongoose.Schema(
  {
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Seller',
      required: true,
      index: true,
    },
    venueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    timeSlots: [{
      type: String,
      required: true,
    }],
    bookedSlots: [{
      type: String,
      default: [],
    }]
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure uniqueness per venue and date
sellerVenueAvailabilitySchema.index({ venueId: 1, date: 1 }, { unique: true });

const SellerVenueAvailability = mongoose.model('SellerVenueAvailability', sellerVenueAvailabilitySchema);
export default SellerVenueAvailability;
