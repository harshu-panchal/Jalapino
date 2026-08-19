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
        
        let liveKitchens = await LiveKitchen.find(query)
            .sort({ updatedAt: -1 })
            .populate("sellerId", "name shopName logo")
            .limit(20);

        if (!liveKitchens || liveKitchens.length === 0) {
            liveKitchens = [
                {
                    _id: 'mock1',
                    sellerId: { shopName: 'Haldiram Live Kitchen' },
                    cookingStatus: 'Preparing Ingredients',
                    streamUrl: 'https://youtube.com/shorts/3i_p4f-T4hI',
                    photoUpdates: [{ imageUrl: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=300' }]
                },
                {
                    _id: 'mock2',
                    sellerId: { shopName: 'Ramu Kaka Caterers' },
                    cookingStatus: 'Cooking Now',
                    streamUrl: 'https://youtube.com/shorts/xQ_IQS3VKjA',
                    photoUpdates: [{ imageUrl: 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=300' }]
                }
            ];
        }
        
        return handleResponse(res, 200, "Public live streams fetched", liveKitchens);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// @route   POST /api/kitchen/streams/:id/like
// @desc    Toggle like for a live stream
// @access  Private (Customer)
export const toggleStreamLike = async (req, res) => {
    try {
        const streamId = req.params.id;
        const customerId = req.user.id;

        // Skip DB if it's a mock stream ID
        if (streamId === 'mock1' || streamId === 'mock2') {
            return handleResponse(res, 200, "Mock stream liked", { liked: true, totalLikes: 1 });
        }

        const liveKitchen = await LiveKitchen.findById(streamId);
        
        if (!liveKitchen) {
            return handleResponse(res, 404, "Live stream not found");
        }
        
        const isLiked = liveKitchen.likes.includes(customerId);
        
        if (isLiked) {
            liveKitchen.likes.pull(customerId);
        } else {
            liveKitchen.likes.push(customerId);
        }
        
        await liveKitchen.save();
        
        return handleResponse(res, 200, "Like toggled successfully", {
            liked: !isLiked,
            totalLikes: liveKitchen.likes.length
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};
