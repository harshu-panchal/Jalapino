import os from 'os';
import mongoose from 'mongoose';
import SystemLog from '../models/system/SystemLog.js';
import handleResponse from '../utils/helper.js';

// Get Operations Dashboard Metrics
export const getSystemHealth = async (req, res) => {
    try {
        const cpus = os.cpus();
        const memoryUsage = process.memoryUsage();
        
        const health = {
            status: mongoose.connection.readyState === 1 ? 'Healthy' : 'Critical',
            database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
            storage: 'Connected', // Assuming Multer is connected locally/Cloudinary
            uptime: process.uptime(),
            cpuUsage: cpus[0].speed,
            memory: {
                total: os.totalmem(),
                free: os.freemem(),
                heapTotal: memoryUsage.heapTotal,
                heapUsed: memoryUsage.heapUsed
            },
            activeIncidents: await SystemLog.countDocuments({ level: 'critical', resolved: false }),
            errorCount24h: await SystemLog.countDocuments({ 
                createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
                level: { $in: ['error', 'critical'] }
            })
        };

        return handleResponse(res, 200, 'System health fetched successfully', health);
    } catch (error) {
        return handleResponse(res, 500, 'Failed to fetch system health');
    }
};

// Get System Logs
export const getSystemLogs = async (req, res) => {
    try {
        const { level, category, limit = 50 } = req.query;
        let query = {};
        if (level) query.level = level;
        if (category) query.category = category;

        const logs = await SystemLog.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit));

        return handleResponse(res, 200, 'Logs fetched successfully', logs);
    } catch (error) {
        return handleResponse(res, 500, 'Failed to fetch system logs');
    }
};

// Create a log entry manually (Useful for frontend/admin logging)
export const createSystemLog = async (req, res) => {
    try {
        const { level, category, message, details, path, method } = req.body;
        
        const log = await SystemLog.create({
            level,
            category,
            message,
            details,
            path,
            method,
            user: req.user?.id || req.user?.sellerId || null
        });

        return handleResponse(res, 201, 'Log created successfully', log);
    } catch (error) {
        return handleResponse(res, 500, 'Failed to create log');
    }
};

// Mark log as resolved
export const resolveLog = async (req, res) => {
    try {
        const { id } = req.params;
        await SystemLog.findByIdAndUpdate(id, { resolved: true });
        return handleResponse(res, 200, 'Log marked as resolved');
    } catch (error) {
        return handleResponse(res, 500, 'Failed to resolve log');
    }
};
