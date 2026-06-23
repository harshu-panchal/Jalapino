import mongoose from 'mongoose';

const categoryCommissionRuleSchema = new mongoose.Schema({
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EventCategory',
        required: true,
        unique: true
    },
    commissionType: {
        type: String,
        enum: ['PERCENTAGE', 'FLAT', 'HYBRID'],
        default: 'PERCENTAGE'
    },
    commissionValue: {
        type: Number,
        default: 10
    },
    subscriptionRequired: {
        type: Boolean,
        default: false
    },
    settlementMode: {
        type: String,
        default: 'POST_EVENT'
    }
}, {
    timestamps: true
});

const CategoryCommissionRule = mongoose.model('CategoryCommissionRule', categoryCommissionRuleSchema);
export default CategoryCommissionRule;
