import mongoose from 'mongoose';

const feedbackSchema = new mongoose.Schema({
    source: { type: String, enum: ['CUSTOMER', 'SELLER', 'ADMIN'], required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, refPath: 'userModel' },
    userModel: { type: String, enum: ['Customer', 'Seller', 'Admin'] },
    feedbackType: { type: String, enum: ['FEATURE_SUGGESTION', 'PERFORMANCE_ISSUE', 'SECURITY_CONCERN', 'GENERAL'], required: true },
    content: { type: String, required: true },
    status: { type: String, enum: ['NEW', 'REVIEWED', 'ACTION_TAKEN', 'CLOSED'], default: 'NEW' }
}, { timestamps: true });

export default mongoose.model('Feedback', feedbackSchema);
