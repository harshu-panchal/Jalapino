import mongoose from 'mongoose';

const sellerPackageSchema = new mongoose.Schema({
    seller: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Seller',
        required: true
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EventCategory',
        required: true
    },
    template: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PackageTemplate',
        required: true
    },
    pricing: {
        type: Number,
        required: true
    },
    images: [{
        type: String // URLs to images
    }],
    availability: {
        type: Boolean,
        default: true
    },
    capacity: {
        type: Number
    },
    customDescription: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

const SellerPackage = mongoose.model('SellerPackage', sellerPackageSchema);
export default SellerPackage;
