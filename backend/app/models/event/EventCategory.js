import mongoose from 'mongoose';

const eventCategorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    description: {
        type: String,
        trim: true
    },
    icon: {
        type: String, // URL to icon
    },
    isActive: {
        type: Boolean,
        default: true
    },
    // Category Feature Plugin Engine Foundation
    activePlugins: [{
        type: String,
        trim: true
    }],
    // Allows admin to sort categories
    sortOrder: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

const EventCategory = mongoose.model('EventCategory', eventCategorySchema);
export default EventCategory;
