import mongoose from 'mongoose';

const supportTicketSchema = new mongoose.Schema({
    ticketId: {
        type: String,
        required: true,
        unique: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    userType: {
        type: String,
        enum: ['customer', 'seller'],
        default: 'customer'
    },
    category: {
        type: String,
        enum: ['booking', 'payment', 'technical', 'account', 'other'],
        required: true
    },
    priority: {
        type: String,
        enum: ['critical', 'high', 'medium', 'low'],
        default: 'medium'
    },
    status: {
        type: String,
        enum: ['open', 'in_progress', 'waiting', 'resolved', 'closed'],
        default: 'open'
    },
    subject: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    attachments: [{
        type: String // URLs to uploaded files
    }],
    relatedBooking: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EventBooking'
    },
    resolutionNotes: {
        type: String
    },
    slaDeadline: {
        type: Date
    },
    slaViolated: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Auto-generate ticket ID and SLA
supportTicketSchema.pre('save', function(next) {
    if (this.isNew && !this.ticketId) {
        // Generate a random ticket ID like TKT-1A2B3C
        const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
        this.ticketId = `TKT-${randomStr}`;
        
        // Calculate SLA Deadline
        const now = new Date();
        switch(this.priority) {
            case 'critical': this.slaDeadline = new Date(now.getTime() + 1 * 60 * 60 * 1000); break; // 1 Hour
            case 'high': this.slaDeadline = new Date(now.getTime() + 4 * 60 * 60 * 1000); break; // 4 Hours
            case 'medium': this.slaDeadline = new Date(now.getTime() + 24 * 60 * 60 * 1000); break; // 24 Hours
            case 'low': this.slaDeadline = new Date(now.getTime() + 72 * 60 * 60 * 1000); break; // 72 Hours
            default: this.slaDeadline = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        }
    }
    next();
});

// Index for filtering
supportTicketSchema.index({ status: 1, priority: 1, createdAt: -1 });

export default mongoose.model('SupportTicket', supportTicketSchema);
