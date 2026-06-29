import mongoose from 'mongoose';

const changeRequestSchema = new mongoose.Schema({
    changeId: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    impactAnalysis: { type: String, required: true },
    approvalStatus: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
    deploymentStatus: { type: String, enum: ['PENDING', 'DEPLOYED', 'FAILED', 'ROLLBACK'], default: 'PENDING' },
    closureStatus: { type: String, enum: ['OPEN', 'CLOSED'], default: 'OPEN' }
}, { timestamps: true });

export default mongoose.model('ChangeRequest', changeRequestSchema);
