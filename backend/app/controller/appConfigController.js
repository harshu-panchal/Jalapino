import AppConfig from '../models/AppConfig.js';
import handleResponse from '../utils/helper.js';

// Get all configs (Admin only)
export const getAllConfigs = async (req, res) => {
    try {
        if (req.user.role !== 'admin') return handleResponse(res, 403, 'Unauthorized');
        const configs = await AppConfig.find().sort({ group: 1, key: 1 });
        return handleResponse(res, 200, 'Configs fetched successfully', configs);
    } catch (error) {
        return handleResponse(res, 500, 'Failed to fetch configs');
    }
};

// Update or create config (Admin only)
export const updateConfig = async (req, res) => {
    try {
        if (req.user.role !== 'admin') return handleResponse(res, 403, 'Unauthorized');

        const { key, value, description, group } = req.body;
        if (!key || value === undefined) {
            return handleResponse(res, 400, 'Key and value are required');
        }

        const config = await AppConfig.findOneAndUpdate(
            { key },
            { value, description, group },
            { new: true, upsert: true }
        );

        return handleResponse(res, 200, 'Config updated successfully', config);
    } catch (error) {
        return handleResponse(res, 500, 'Failed to update config');
    }
};

// Utility to fetch a specific config internally
export const getConfigValue = async (key, defaultValue) => {
    try {
        const config = await AppConfig.findOne({ key });
        return config ? config.value : defaultValue;
    } catch (error) {
        return defaultValue;
    }
};
