import mongoose from 'mongoose';

const enhancementRequestSchema = new mongoose.Schema({
    requestId: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    businessJustification: { type: String, required: true },
    priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'MEDIUM' },
    approvalStatus: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
    targetRelease: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductVersion' }
}, { timestamps: true });

export default mongoose.model('EnhancementRequest', enhancementRequestSchema);
