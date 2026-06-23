import mongoose from 'mongoose';

const categoryDocumentRuleSchema = new mongoose.Schema({
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EventCategory',
        required: true
    },
    documentName: {
        type: String,
        required: true,
        trim: true
    },
    mandatory: {
        type: Boolean,
        default: true
    },
    expiryRequired: {
        type: Boolean,
        default: false
    },
    verificationRequired: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

const CategoryDocumentRule = mongoose.model('CategoryDocumentRule', categoryDocumentRuleSchema);
export default CategoryDocumentRule;
