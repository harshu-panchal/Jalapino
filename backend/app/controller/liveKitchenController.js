import LiveKitchen from "../models/liveKitchen.js";
import { handleResponse } from "../utils/helper.js";

// @route   POST /api/kitchen/stream
// @desc    Update or create live stream URL for a seller
// @access  Private (Seller/Admin)
export const updateStreamUrl = async (req, res) => {
    try {
        const { streamUrl, orderId } = req.body;
        const sellerId = req.user.id; // assuming seller authentication middleware is applied

        let liveKitchen = await LiveKitchen.findOne({ sellerId, orderId: orderId || null });
        
        if (liveKitchen) {
            liveKitchen.streamUrl = streamUrl;
            liveKitchen.isActive = true;
            await liveKitchen.save();
        } else {
            liveKitchen = await LiveKitchen.create({ sellerId, orderId: orderId || null, streamUrl });
        }
        
        return handleResponse(res, 200, "Stream URL updated successfully", liveKitchen);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// @route   POST /api/kitchen/photo
// @desc    Add a photo update for an order's cooking progress
// @access  Private (Seller/Admin)
export const addPhotoUpdate = async (req, res) => {
    try {
        const { orderId, imageUrl, description, cookingStatus } = req.body;
        const sellerId = req.user.id;

        let liveKitchen = await LiveKitchen.findOne({ sellerId, orderId: orderId || null });
        
        if (!liveKitchen) {
            liveKitchen = await LiveKitchen.create({ sellerId, orderId, cookingStatus: cookingStatus || "Preparing Ingredients" });
        }

        if (cookingStatus) liveKitchen.cookingStatus = cookingStatus;
        if (imageUrl) {
            liveKitchen.photoUpdates.push({ imageUrl, description, timestamp: new Date() });
        }
        
        await liveKitchen.save();
        
        return handleResponse(res, 200, "Kitchen photo update added", liveKitchen);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// @route   GET /api/kitchen/:sellerId/:orderId?
// @desc    Get live kitchen status for customer view
// @access  Public
export const getLiveKitchenStatus = async (req, res) => {
    try {
        const { sellerId, orderId } = req.params;
        const query = { sellerId, isActive: true, isCustomerVisible: true };
        
        if (orderId) {
            query.orderId = orderId;
        } else {
            query.orderId = null; // Get general seller stream
        }

        const liveKitchen = await LiveKitchen.findOne(query).sort({ updatedAt: -1 });
        
        if (!liveKitchen) {
            return handleResponse(res, 404, "No active live kitchen found");
        }
        
        return handleResponse(res, 200, "Live kitchen fetched", liveKitchen);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// @route   GET /api/kitchen/public/streams
// @desc    Get all active public live kitchen streams for Reels
// @access  Public
export const getPublicLiveStreams = async (req, res) => {
    try {
        const query = { isActive: true, isCustomerVisible: true, streamUrl: { $ne: "" } };
        
        const liveKitchens = await LiveKitchen.find(query)
            .sort({ updatedAt: -1 })
            .populate("sellerId", "name shopName logo")
            .limit(20);
        
        return handleResponse(res, 200, "Public live streams fetched", liveKitchens);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};
