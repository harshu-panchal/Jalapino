import SellerCalendar from '../models/event/SellerCalendar.js';
import handleResponse from '../utils/helper.js';

// Get calendar configuration (blocked dates, custom capacities)
export const getCalendarConfig = async (req, res) => {
    try {
        const sellerId = req.user.sellerId || req.user.id || req.user._id;

        let calendar = await SellerCalendar.findOne({ seller: sellerId }).lean();
        if (!calendar) {
            return handleResponse(res, 200, 'Calendar fetched', { blockedDates: [], customCapacities: [] });
        }

        // Return blockedDates as plain date strings so frontend can easily parse them
        const formatted = {
            ...calendar,
            blockedDates: (calendar.blockedDates || []).map(b => b.date || b).filter(Boolean),
        };

        return handleResponse(res, 200, 'Calendar fetched', formatted);
    } catch (error) {
        console.error("Calendar fetch error:", error);
        return handleResponse(res, 500, 'Failed to fetch calendar');
    }
};

// Update blocked dates
export const updateBlockedDates = async (req, res) => {
    try {
        const sellerId = req.user.sellerId || req.user.id || req.user._id;
        const { blockedDates } = req.body; // Array of YYYY-MM-DD strings

        if (!Array.isArray(blockedDates)) {
            return handleResponse(res, 400, 'blockedDates must be an array');
        }

        let calendar = await SellerCalendar.findOne({ seller: sellerId });

        if (!calendar) {
            calendar = new SellerCalendar({ seller: sellerId, blockedDates: [] });
        }

        // Map to schema format: { date: "YYYY-MM-DD", type: "PERSONAL" }
        calendar.blockedDates = blockedDates
            .filter(d => typeof d === 'string' && d.trim())
            .map(dateStr => ({
                date: dateStr.trim(),
                type: 'PERSONAL',
            }));

        await calendar.save();

        return handleResponse(res, 200, 'Blocked dates updated successfully', {
            blockedDates: calendar.blockedDates.map(b => b.date),
        });
    } catch (error) {
        console.error("Update blocked dates error:", error);
        return handleResponse(res, 500, 'Failed to update blocked dates');
    }
};

