import SellerCalendar from '../models/event/SellerCalendar.js';
import EventBooking from '../models/event/EventBooking.js';
import mongoose from 'mongoose';
import { isEventBookingCalendarLocked } from '../utils/advanceBooking.js';
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

        // A date that already has a PAID booking cannot be newly blocked
        // (already-blocked dates stay as they are).
        const alreadyBlocked = new Set((calendar.blockedDates || []).map(b => b.date));
        const newDates = [...new Set(blockedDates.filter(d => typeof d === 'string' && d.trim()).map(d => d.trim()))]
            .filter(d => !alreadyBlocked.has(d));
        if (newDates.length > 0) {
            const activeServiceStatus = { $in: ['ACCEPTED', 'PENDING_APPROVAL', 'COMPLETED'] };
            const bookings = await EventBooking.find({
                services: { $elemMatch: { seller: mongoose.Types.ObjectId.isValid(String(sellerId)) ? new mongoose.Types.ObjectId(String(sellerId)) : sellerId, status: activeServiceStatus } },
                overallStatus: { $nin: ['CANCELLED', 'REJECTED'] },
                $or: [
                    ...newDates.map(d => ({ eventDate: { $gte: new Date(`${d}T00:00:00`), $lte: new Date(`${d}T23:59:59.999`) } })),
                    { 'multipleEvents.date': { $in: newDates } },
                ],
            }).select('eventDate multipleEvents amountPaid paymentStatus paymentMode overallStatus').lean();
            const toLocalDate = (value) => {
                const dt = new Date(value);
                if (Number.isNaN(dt.getTime())) return '';
                return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
            };
            const bookedDates = new Set();
            for (const b of bookings.filter(isEventBookingCalendarLocked)) {
                bookedDates.add(toLocalDate(b.eventDate));
                (b.multipleEvents || []).forEach(e => e?.date && bookedDates.add(String(e.date).slice(0, 10)));
            }
            const conflict = newDates.find(d => bookedDates.has(d));
            if (conflict) {
                return handleResponse(res, 400, `${conflict} has a paid booking, so it cannot be blocked.`);
            }
        }

        // Map to schema format: { date: "YYYY-MM-DD", type: "PERSONAL" }
        calendar.blockedDates = blockedDates
            .filter(d => typeof d === 'string' && d.trim())
            .map(dateStr => ({
                date: dateStr.trim(),
                type: 'PERSONAL',
            }));

        await calendar.save();

        // Live update: customer screens on this seller's page refresh blocked dates.
        try {
            const { getIO } = await import('../socket/socketManager.js');
            getIO().emit('seller_calendar_updated', {
                sellerId: String(sellerId),
                blockedDates: calendar.blockedDates.map(b => b.date),
            });
        } catch (socketError) {
            /* socket not ready - customers still get it on next date pick / booking check */
        }

        return handleResponse(res, 200, 'Blocked dates updated successfully', {
            blockedDates: calendar.blockedDates.map(b => b.date),
        });
    } catch (error) {
        console.error("Update blocked dates error:", error);
        return handleResponse(res, 500, 'Failed to update blocked dates');
    }
};

