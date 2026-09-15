import mongoose from 'mongoose';

const eventCategorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    description: {
        type: String,
        trim: true
    },
    icon: {
        type: String, // URL to icon
    },
    isActive: {
        type: Boolean,
        default: true
    },
    // Category Feature Plugin Engine Foundation
    activePlugins: [{
        type: String,
        trim: true
    }],
    showDateFilters: {
        type: Boolean,
        default: true
    },
    showEventDetailsForm: {
        type: Boolean,
        default: true
    },
    showNoOfGuestsBox: {
        type: Boolean,
        default: false
    },
    // Allows admin to sort categories
    sortOrder: {
        type: Number,
        default: 0
    },
    // Contact Options
    primaryContactEnabled: { type: Boolean, default: false },
    coupleContactEnabled: { type: Boolean, default: false },
    noOfGuestsEnabled: { type: Boolean, default: false },
    
    // Date & Time Slot Settings
    showStandardDateTime: { type: Boolean, default: false },
    showStandardDateTimeSlot: { type: Boolean, default: false },
    showAdvancedDateTime: { type: Boolean, default: false },
    showAdvancedDateTimeSlot: { type: Boolean, default: false },
    showMultipleDateTime: { type: Boolean, default: false },
    
    // Location Options
    functionLocationEnabled: { type: Boolean, default: false },
    sellerLocationEnabled: { type: Boolean, default: false },
    
    // Customization & Quotation Engine Settings
    quoteReferencePhotoUpload: { type: Boolean, default: false },
    quoteColorCombination: { type: Boolean, default: false },
    quoteCustomerNotes: { type: Boolean, default: false },
    quoteSellerQuotation: { type: Boolean, default: false },
    quoteQuoteRevision: { type: Boolean, default: false },
    quoteCustomerApproval: { type: Boolean, default: false },
    quoteAdvancePayment: { type: Boolean, default: false },
    quoteFinalPayment: { type: Boolean, default: false },
    
    // Event & Ticketing Options
    ticketSystemEnabled: { type: Boolean, default: false },
    venueVisitsEnabled: { type: Boolean, default: false },
}, {
    timestamps: true
});

const EventCategory = mongoose.model('EventCategory', eventCategorySchema);
export default EventCategory;
