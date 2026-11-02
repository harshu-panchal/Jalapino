import mongoose from 'mongoose';

const preferenceValueSchema = new mongoose.Schema({
    fieldName: { type: String, required: true },
    value: { type: mongoose.Schema.Types.Mixed }, // String, Number, Array of strings
    fileUrls: [{ type: String }] // For uploaded images/files
});

const eventServiceAssignmentSchema = new mongoose.Schema({
    seller: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Seller'
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EventCategory'
    },
    amount: {
        type: Number
    },
    status: {
        type: String,
        enum: ['PENDING_APPROVAL', 'ACCEPTED', 'REJECTED', 'CLARIFICATION_REQUESTED', 'COMPLETED'],
        default: 'PENDING_APPROVAL'
    },
    rating: { type: Number, min: 1, max: 5 },
    review: { type: String, trim: true },
    preferences: [preferenceValueSchema],
    specialInstructions: { type: String },
    sellerNotes: { type: String },
    quotePermissions: {
        sellerQuotation: { type: Boolean, default: false },
        revision: { type: Boolean, default: false },
        customerApproval: { type: Boolean, default: false }
    },
    quotation: {
        amount: { type: Number },
        note: { type: String, trim: true },
        status: { type: String, enum: ['NOT_SENT', 'PENDING_CUSTOMER', 'REVISION_REQUESTED', 'APPROVED'], default: 'NOT_SENT' },
        revisionNote: { type: String, trim: true },
        sentAt: { type: Date },
        approvedAt: { type: Date },
        revisionRequestedAt: { type: Date }
    }
});

const eventBookingSchema = new mongoose.Schema({
    bookingId: {
        type: String,
        required: true,
        unique: true
    },
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    eventType: { type: String, required: true },
    guestCount: { type: Number, required: true },
    budget: { type: Number },
    eventDate: { type: Date },
    eventTime: { type: String },
    remarks: { type: String },
    multipleEvents: [{
        id: String,
        typeId: String,
        typeName: String,
        date: String,
        time: String,
        remarks: String
    }],
    eventInfo: { type: mongoose.Schema.Types.Mixed },
    selectedProducts: [{
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        productName: String,
        quantity: Number,
        price: Number,
        unitPrice: Number,
        selectedColors: [String],
        selectedVariant: { type: mongoose.Schema.Types.Mixed },
        uniqueCode: { type: String, trim: true, default: '' },
        shopNo: { type: String, trim: true, default: '' },
        selectedAddOns: [{
            name: String,
            price: Number,
            isFixed: Boolean
        }]
    }],
    selectedShop: {
        uniqueCode: { type: String, trim: true, default: '' },
        shopNo: { type: String, trim: true, default: '' },
        bookingType: { type: String, trim: true, default: '' },
        capacityType: { type: String, trim: true, default: '' },
        minimum: { type: Number, default: 0 },
        maximum: { type: Number, default: 0 },
        totalCapacity: { type: Number, default: 0 }
    },
    advancePaymentAmount: { type: Number },
    advancePaymentPercentage: { type: Number },
    location: {
        address: String,
        coordinates: {
            lat: Number,
            lng: Number
        }
    },
    services: [eventServiceAssignmentSchema],
    totalAmount: { type: Number, required: true },
    paymentStatus: {
        type: String,
        enum: ['PENDING', 'ADVANCE_PAID', 'PAID', 'FAILED', 'REFUNDED'],
        default: 'PENDING'
    },
    paymentMode: {
        type: String,
        enum: ['ONLINE', 'COD']
    },
    overallStatus: {
        type: String,
        enum: ['PENDING', 'PAYMENT_PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
        default: 'PENDING'
    },
    completedAt: { type: Date },
    reviewNotificationSent: { type: Boolean, default: false },
    reviewNotificationSentAt: { type: Date },
    sellerRating: { type: Number, min: 1, max: 5 },
    sellerReview: { type: String, trim: true },
    sellerReviewedAt: { type: Date },
    customerRatingBySeller: { type: Number, min: 1, max: 5 },
    customerReviewBySeller: { type: String, trim: true },
    customerReviewedAt: { type: Date }
}, {
    timestamps: true
});

const EventBooking = mongoose.model('EventBooking', eventBookingSchema);
export default EventBooking;
