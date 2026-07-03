import SellerPackage from '../models/event/SellerPackage.js';
import PackageTemplate from '../models/event/PackageTemplate.js';
import Seller from '../models/seller.js';
import handleResponse from '../utils/helper.js';

// Get available templates for the seller's categories
export const getAvailableTemplates = async (req, res) => {
    try {
        const sellerId = req.user.sellerId || req.user.id;

        // Find the seller to get their service categories
        const seller = await Seller.findById(sellerId).select('serviceCategories');
        if (!seller || !seller.serviceCategories || seller.serviceCategories.length === 0) {
            return handleResponse(res, 200, 'No service categories assigned', []);
        }

        // Find templates for those categories
        const templates = await PackageTemplate.find({
            category: { $in: seller.serviceCategories },
            isActive: true
        }).populate('category', 'name').lean();

        return handleResponse(res, 200, 'Available templates fetched successfully', templates);
    } catch (error) {
        console.error('Error fetching available templates:', error);
        return handleResponse(res, 500, 'Failed to fetch available templates');
    }
};

// Get the seller's configured packages
export const getSellerPackages = async (req, res) => {
    try {
        const sellerId = req.user.sellerId || req.user.id;

        const packages = await SellerPackage.find({ seller: sellerId })
            .populate('category', 'name')
            .populate('template', 'packageName includedFeatures optionalFeatures description')
            .lean();

        return handleResponse(res, 200, 'Seller packages fetched successfully', packages);
    } catch (error) {
        console.error('Error fetching seller packages:', error);
        return handleResponse(res, 500, 'Failed to fetch seller packages');
    }
};

// Create or update a seller package
export const createOrUpdateSellerPackage = async (req, res) => {
    try {
        const sellerId = req.user.sellerId || req.user.id;
        const { templateId, categoryId, pricing, images, availability, capacity, customDescription } = req.body;

        if (!templateId || !categoryId || pricing === undefined) {
            return handleResponse(res, 400, 'Template, Category, and Pricing are required');
        }

        // Check if package exists for this template
        let sellerPackage = await SellerPackage.findOne({ seller: sellerId, template: templateId });

        if (sellerPackage) {
            // Update
            sellerPackage.pricing = pricing;
            if (images) sellerPackage.images = images;
            if (availability !== undefined) sellerPackage.availability = availability;
            if (capacity !== undefined) sellerPackage.capacity = capacity;
            if (customDescription !== undefined) sellerPackage.customDescription = customDescription;

            await sellerPackage.save();
            return handleResponse(res, 200, 'Seller package updated successfully', sellerPackage);
        } else {
            // Create
            sellerPackage = await SellerPackage.create({
                seller: sellerId,
                category: categoryId,
                template: templateId,
                pricing,
                images: images || [],
                availability: availability !== undefined ? availability : true,
                capacity,
                customDescription
            });
            return handleResponse(res, 201, 'Seller package created successfully', sellerPackage);
        }

    } catch (error) {
        console.error('Error saving seller package:', error);
        return handleResponse(res, 500, 'Failed to save seller package');
    }
};

// Delete a seller package
export const deleteSellerPackage = async (req, res) => {
    try {
        const sellerId = req.user.sellerId || req.user.id;
        const { id } = req.params;

        const deletedPackage = await SellerPackage.findOneAndDelete({ _id: id, seller: sellerId });

        if (!deletedPackage) {
            return handleResponse(res, 404, 'Seller package not found');
        }

        return handleResponse(res, 200, 'Seller package deleted successfully');
    } catch (error) {
        console.error('Error deleting seller package:', error);
        return handleResponse(res, 500, 'Failed to delete seller package');
    }
};
