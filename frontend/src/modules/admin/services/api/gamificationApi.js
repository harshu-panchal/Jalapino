import axiosInstance from '@core/api/axios';

/**
 * Admin gamification endpoints.
 */
export const adminGamificationApi = {
    getWheelRewards: () => axiosInstance.get('/gamification/admin/rewards'),
    createWheelReward: (data) => axiosInstance.post('/gamification/admin/rewards', data),
    updateWheelReward: (id, data) => axiosInstance.put(`/gamification/admin/rewards/${id}`, data),
    deleteWheelReward: (id) => axiosInstance.delete(`/gamification/admin/rewards/${id}`),
    getGamificationStats: () => axiosInstance.get('/gamification/admin/stats'),
};

export default adminGamificationApi;
