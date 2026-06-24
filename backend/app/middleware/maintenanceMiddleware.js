import Setting from '../models/setting.js';
import handleResponse from '../utils/helper.js';

let cachedSettings = null;
let lastFetchTime = 0;
const CACHE_TTL = 2000; // 2 seconds

export const checkMaintenanceMode = async (req, res, next) => {
    try {
        // Exclude admin routes and settings from maintenance mode so admin can turn it off
        // and frontend can check if maintenance is over
        if (req.originalUrl.startsWith('/api/admin') || req.originalUrl.startsWith('/api/settings')) {
            return next();
        }

        const now = Date.now();
        if (!cachedSettings || now - lastFetchTime > CACHE_TTL) {
            cachedSettings = await Setting.findOne({}).lean();
            lastFetchTime = now;
        }

        if (cachedSettings && cachedSettings.maintenanceMode) {
            return res.status(503).json({
                success: false,
                maintenance: true,
                message: cachedSettings.maintenanceMessage || 'Platform is under maintenance',
                expectedCompletion: cachedSettings.maintenanceExpectedCompletion
            });
        }

        next();
    } catch (error) {
        console.error("Maintenance check error:", error);
        next(); // If db fails, let it pass to not break app accidentally
    }
};
