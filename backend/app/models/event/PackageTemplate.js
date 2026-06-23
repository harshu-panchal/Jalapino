import mongoose from 'mongoose';

const packageTemplateSchema = new mongoose.Schema({
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EventCategory',
        required: true
    },
    packageName: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    includedFeatures: [{
        type: String,
        trim: true
    }],
    optionalFeatures: [{
        type: String,
        trim: true
    }],
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

const PackageTemplate = mongoose.model('PackageTemplate', packageTemplateSchema);
export default PackageTemplate;
