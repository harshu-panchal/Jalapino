import mongoose from 'mongoose';

const categoryWorkflowSchema = new mongoose.Schema({
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EventCategory',
        required: true,
        unique: true
    },
    workflowSteps: [{
        type: String, // e.g. 'Customer', 'Seller Approval', 'Payment', 'Booking Confirmed'
        trim: true
    }]
}, {
    timestamps: true
});

const CategoryWorkflow = mongoose.model('CategoryWorkflow', categoryWorkflowSchema);
export default CategoryWorkflow;
