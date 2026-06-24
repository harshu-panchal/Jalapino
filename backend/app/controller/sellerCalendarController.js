import SellerCalendar from '../models/event/SellerCalendar.js';
import handleResponse from '../utils/helper.js';

// Get calendar configuration (blocked dates, custom capacities)
export const getCalendarConfig = async (req, res) => {
    try {
        const sellerId = req.user.sellerId || req.user.id || req.user._id;
        
        let calendar = await SellerCalendar.findOne({ seller: sellerId });
        if (!calendar) {
            // Return empty/default config if none exists
            return handleResponse(res, 200, 'Calendar fetched', { blockedDates: [], customCapacities: [] });
        }
        
        return handleResponse(res, 200, 'Calendar fetched', calendar);
    } catch (error) {
        console.error("Calendar fetch error:", error);
        return handleResponse(res, 500, 'Failed to fetch calendar');
    }
};

// Update blocked dates
export const updateBlockedDates = async (req, res) => {
    try {
        const sellerId = req.user.sellerId || req.user.id || req.user._id;
        const { blockedDates } = req.body; // Array of dates in YYYY-MM-DD format
        
        if (!Array.isArray(blockedDates)) {
            return handleResponse(res, 400, 'blockedDates must be an array');
        }

        let calendar = await SellerCalendar.findOne({ seller: sellerId });
        
        if (!calendar) {
            calendar = new SellerCalendar({ seller: sellerId, blockedDates: [] });
        }
        
        // Convert input strings to Date objects to ensure consistent storage
        calendar.blockedDates = blockedDates.map(dateStr => new Date(dateStr));
        
        await calendar.save();
        
        return handleResponse(res, 200, 'Blocked dates updated successfully', calendar);
    } catch (error) {
        console.error("Update blocked dates error:", error);
        return handleResponse(res, 500, 'Failed to update blocked dates');
    }
};
