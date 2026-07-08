import mongoose from 'mongoose';

const citySchema = new mongoose.Schema({
    state: {
        type: String,
        required: true,
        trim: true
    },
    cityName: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    pinCodes: [{
        type: String
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    readinessStatus: {
        type: String,
        enum: ['Ready', 'Partially Ready', 'Not Ready'],
        default: 'Not Ready'
    },
    retailEnabled: {
        type: Boolean,
        default: true
    },
    planMyEventEnabled: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

const City = mongoose.model('City', citySchema);
export default City;
