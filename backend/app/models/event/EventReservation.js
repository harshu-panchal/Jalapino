import mongoose from 'mongoose';

const eventReservationSchema = new mongoose.Schema({
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    seller: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Seller',
        required: true
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EventCategory',
        required: true
    },
    eventDate: {
        type: Date,
        required: true
    },
    eventTime: {
        type: String, // e.g., '18:00'
        required: true
    },
    guestCount: {
        type: Number,
        required: true
    },
    expiresAt: {
        type: Date,
        required: true,
        index: { expires: 0 } // TTL index: automatically deletes document when expiresAt is reached
    },
    status: {
        type: String,
        enum: ['RESERVED', 'CONFIRMED', 'EXPIRED'],
        default: 'RESERVED'
    }
}, {
    timestamps: true
});

const EventReservation = mongoose.model('EventReservation', eventReservationSchema);
export default EventReservation;
