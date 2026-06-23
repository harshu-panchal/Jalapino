import mongoose from 'mongoose';

const categoryBusinessRuleSchema = new mongoose.Schema({
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EventCategory',
        required: true,
        unique: true
    },
    advancePaymentPercentage: {
        type: Number,
        default: 0
    },
    sellerApprovalRequired: {
        type: Boolean,
        default: true
    },
    instantBookingEnabled: {
        type: Boolean,
        default: false
    },
    venueVisitRequired: {
        type: Boolean,
        default: false
    },
    availabilityValidationRequired: {
        type: Boolean,
        default: true
    },
    cancellationPolicyId: {
        type: mongoose.Schema.Types.ObjectId, // Ref to a generic CancellationPolicy model in future
        ref: 'CancellationPolicy'
    },
    autoAssignSeller: {
        type: Boolean,
        default: false
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

const CategoryBusinessRule = mongoose.model('CategoryBusinessRule', categoryBusinessRuleSchema);
export default CategoryBusinessRule;
