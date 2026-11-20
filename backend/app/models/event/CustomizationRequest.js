import mongoose from 'mongoose';

// Customization & Quotation request - kept separate from EventBooking.
// Flow: REQUESTED -> QUOTED (seller sends final quotation) -> APPROVED (customer)
//       -> CONFIRMED (customer paid advance/full online, or chose COD)
//       REVISION_REQUESTED (customer asks for a new quote) / REJECTED (seller) / CANCELLED (customer)
const customizationRequestSchema = new mongoose.Schema({
    requestId: { type: String, required: true, unique: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true, index: true },
    chatSession: { type: mongoose.Schema.Types.ObjectId, ref: 'EventChatSession' },
    details: {
        decorationType: { type: String, trim: true },
        colors: [{ type: String, trim: true }],
        theme: { type: String, trim: true },
        budget: { type: Number },
        referencePhotoUrl: { type: String, trim: true },
        notes: { type: String, trim: true },
    },
    status: {
        type: String,
        enum: ['REQUESTED', 'QUOTED', 'REVISION_REQUESTED', 'APPROVED', 'CONFIRMED', 'REJECTED', 'CANCELLED'],
        default: 'REQUESTED',
        index: true,
    },
    quotation: {
        amount: { type: Number },
        note: { type: String, trim: true },
        sentAt: { type: Date },
        approvedAt: { type: Date },
        revisionNote: { type: String, trim: true },
        revisionRequestedAt: { type: Date },
    },
    sellerNote: { type: String, trim: true },
    // Payment - same idea as event bookings (advance % from the seller profile).
    advancePaymentPercentage: { type: Number, default: 0 },
    paymentMode: { type: String, enum: ['ONLINE', 'COD'] },
    paymentStatus: { type: String, enum: ['PENDING', 'ADVANCE_PAID', 'PAID'], default: 'PENDING' },
    amountPaid: { type: Number, default: 0 },
    codAmountCollected: { type: Number, default: 0 },
    razorpayPayments: [{
        _id: false,
        paymentId: String,
        orderId: String,
        amount: Number,
        paidAt: Date,
    }],
}, { timestamps: true });

const CustomizationRequest = mongoose.model('CustomizationRequest', customizationRequestSchema);
export default CustomizationRequest;
