import mongoose from 'mongoose';

const eventPayoutSchema = new mongoose.Schema({
    sellerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Seller',
        required: true,
        index: true
    },
    bookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EventBooking',
        required: true,
        unique: true
    },
    totalAmount: {
        type: Number,
        required: true,
        default: 0
    },
    commissionRate: {
        type: Number,
        required: true,
        default: 10
    },
    commissionDeducted: {
        type: Number,
        required: true,
        default: 0
    },
    netPayoutAmount: {
        type: Number,
        required: true,
        default: 0
    },
    status: {
        type: String,
        enum: ['PENDING', 'PROCESSING', 'PAID', 'FAILED'],
        default: 'PENDING'
    },
    paymentMode: {
        type: String,
        enum: ['ONLINE', 'COD'],
        required: true
    },
    settledAt: {
        type: Date
    },
    transactionReference: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

const EventPayout = mongoose.model('EventPayout', eventPayoutSchema);
export default EventPayout;
