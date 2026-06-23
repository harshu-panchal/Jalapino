import mongoose from 'mongoose';

const fieldSchema = new mongoose.Schema({
    fieldName: {
        type: String,
        required: true,
        trim: true
    },
    fieldType: {
        type: String,
        enum: ['TEXT', 'TEXTAREA', 'SELECT', 'MULTISELECT', 'FILE', 'NUMBER', 'DATE'],
        required: true
    },
    isRequired: {
        type: Boolean,
        default: false
    },
    options: [{ // For SELECT and MULTISELECT
        type: String,
        trim: true
    }],
    validationRules: {
        maxLength: Number,
        maxFileSizeMB: Number,
        allowedFileTypes: [String]
    },
    sortOrder: {
        type: Number,
        default: 0
    }
});

const preferenceFormSchema = new mongoose.Schema({
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EventCategory',
        required: true,
        unique: true // One form per category
    },
    fields: [fieldSchema],
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

const PreferenceForm = mongoose.model('PreferenceForm', preferenceFormSchema);
export default PreferenceForm;
