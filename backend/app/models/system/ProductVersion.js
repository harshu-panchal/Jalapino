import mongoose from 'mongoose';

const productVersionSchema = new mongoose.Schema({
    versionNumber: { type: String, required: true },
    buildNumber: { type: String, required: true },
    releaseDate: { type: Date, required: true },
    releaseNotes: { type: String, required: true },
    changeLog: [{ type: String }],
    releaseStatus: { type: String, enum: ['PLANNED', 'BETA', 'STABLE', 'DEPRECATED'], default: 'STABLE' },
    targetPlatforms: [{ type: String, enum: ['ANDROID', 'SELLER_APP', 'ADMIN_PANEL', 'BACKEND_API', 'WEB'] }]
}, { timestamps: true });

export default mongoose.model('ProductVersion', productVersionSchema);
