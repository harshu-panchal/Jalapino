import mongoose from 'mongoose';

const appConfigSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    value: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    description: {
        type: String,
        trim: true
    },
    group: {
        type: String,
        enum: ['GENERAL', 'PAYMENT', 'EVENT', 'COMMUNICATION'],
        default: 'GENERAL'
    }
}, {
    timestamps: true
});

const AppConfig = mongoose.model('AppConfig', appConfigSchema);
export default AppConfig;
