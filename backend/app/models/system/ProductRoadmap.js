import mongoose from 'mongoose';

const productRoadmapSchema = new mongoose.Schema({
    title: { type: String, required: true },
    category: { 
        type: String, 
        enum: ['NEW_CATEGORY', 'AI_MODULES', 'FRANCHISE', 'CORPORATE_EVENTS', 'INTERNATIONAL', 'WHITE_LABEL', 'OTHER'],
        required: true
    },
    priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'MEDIUM' },
    phase: { type: String, enum: ['PHASE_1', 'PHASE_2', 'PHASE_3', 'PHASE_4', 'PHASE_5'], required: true },
    status: { type: String, enum: ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD'], default: 'PLANNED' }
}, { timestamps: true });

export default mongoose.model('ProductRoadmap', productRoadmapSchema);
