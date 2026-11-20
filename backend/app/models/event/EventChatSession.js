import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
    sender: {
        type: String,
        enum: ['customer', 'seller'],
        required: true
    },
    text: {
        type: String,
        required: true
    },
    // Optional image (e.g. customization reference photo) shown in the chat.
    imageUrl: { type: String, trim: true },
    isRead: {
        type: Boolean,
        default: false
    },
    // One message deleted by one side only ("delete for me").
    hiddenForCustomer: { type: Boolean, default: false },
    hiddenForSeller: { type: Boolean, default: false }
}, { timestamps: true });

const eventChatSessionSchema = new mongoose.Schema({
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
    status: {
        type: String,
        enum: ['active', 'closed'],
        default: 'active'
    },
    messages: [messageSchema],
    lastMessageAt: {
        type: Date,
        default: Date.now
    },
    // "Delete chat" for one side only: messages up to this time are hidden for that side.
    customerClearedAt: { type: Date, default: null },
    sellerClearedAt: { type: Date, default: null }
}, {
    timestamps: true
});

const EventChatSession = mongoose.model('EventChatSession', eventChatSessionSchema);
export default EventChatSession;
