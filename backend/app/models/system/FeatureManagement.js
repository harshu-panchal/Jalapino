import mongoose from 'mongoose';

const featureManagementSchema = new mongoose.Schema({
    featureId: { type: String, required: true, unique: true },
    featureName: { type: String, required: true },
    lifecycleStatus: { 
        type: String, 
        enum: ['PLANNED', 'DEVELOPMENT', 'TESTING', 'BETA', 'PRODUCTION', 'DEPRECATED', 'ARCHIVED'],
        default: 'PLANNED'
    },
    rolloutScope: {
        global: { type: Boolean, default: false },
        cities: [{ type: String }],
        categories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'EventCategory' }],
        sellers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Seller' }],
        customers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Customer' }]
    },
    rollbackStatus: { type: Boolean, default: false },
    isEnabled: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model('FeatureManagement', featureManagementSchema);
