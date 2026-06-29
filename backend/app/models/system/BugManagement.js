import mongoose from 'mongoose';

const bugManagementSchema = new mongoose.Schema({
    bugId: { type: String, required: true, unique: true },
    severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'MEDIUM' },
    priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], default: 'MEDIUM' },
    description: { type: String, required: true },
    status: { type: String, enum: ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'FIXED', 'VERIFICATION', 'CLOSED'], default: 'NEW' },
    assignedDeveloper: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    resolutionNotes: { type: String },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }
}, { timestamps: true });

export default mongoose.model('BugManagement', bugManagementSchema);
