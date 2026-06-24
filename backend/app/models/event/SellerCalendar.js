import mongoose from 'mongoose';

const sellerCalendarSchema = new mongoose.Schema({
    seller: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Seller',
        required: true,
        index: true
    },
    blockedDates: [{
        date: { type: String, required: true }, // Format YYYY-MM-DD
        reason: { type: String, trim: true },
        type: { type: String, enum: ['HOLIDAY', 'FULL_CAPACITY', 'PERSONAL'], default: 'PERSONAL' }
    }],
    businessHours: {
        start: { type: String, default: "09:00" },
        end: { type: String, default: "22:00" },
        offDays: [{ type: Number }] // 0 = Sunday, 1 = Monday, etc.
    }
}, {
    timestamps: true
});

const SellerCalendar = mongoose.model('SellerCalendar', sellerCalendarSchema);
export default SellerCalendar;
