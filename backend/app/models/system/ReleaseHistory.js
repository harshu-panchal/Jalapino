import mongoose from 'mongoose';

const releaseHistorySchema = new mongoose.Schema({
    version: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductVersion', required: true },
    deploymentDate: { type: Date, required: true, default: Date.now },
    releaseNotes: { type: String, required: true },
    rollbackInformation: {
        isRollback: { type: Boolean, default: false },
        rollbackReason: { type: String },
        rollbackDate: { type: Date }
    }
}, { timestamps: true });

export default mongoose.model('ReleaseHistory', releaseHistorySchema);
