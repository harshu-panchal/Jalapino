import mongoose from 'mongoose';

const systemLogSchema = new mongoose.Schema({
    level: {
        type: String,
        enum: ['info', 'warning', 'error', 'critical'],
        required: true
    },
    category: {
        type: String,
        enum: ['application', 'api', 'database', 'payment', 'deployment', 'security', 'other'],
        required: true
    },
    message: {
        type: String,
        required: true
    },
    details: {
        type: mongoose.Schema.Types.Mixed // For JSON objects, error stacks, request bodies, etc.
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User' // Optional user association if the error was triggered by a specific user
    },
    path: {
        type: String // API path where the error occurred
    },
    method: {
        type: String
    },
    resolved: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Index for fast searching by level and category
systemLogSchema.index({ level: 1, category: 1, createdAt: -1 });

export default mongoose.model('SystemLog', systemLogSchema);
