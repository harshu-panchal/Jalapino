import mongoose from 'mongoose';

const platformSettingsSchema = new mongoose.Schema({
    featureKey: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    enabled: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

const PlatformSettings = mongoose.model('PlatformSettings', platformSettingsSchema);
export default PlatformSettings;
