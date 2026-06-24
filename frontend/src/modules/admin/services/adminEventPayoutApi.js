import axiosInstance from '@core/api/axios';

export const adminEventPayoutApi = {
    getPayouts: async (params = {}) => {
        try {
            const response = await axiosInstance.get('/admin/event-payouts', { params });
            return response.data?.result || response.data?.results || response.data || [];
        } catch (error) {
            throw error.response?.data?.message || 'Failed to fetch payouts';
        }
    },
    
    settlePayout: async (id, payload) => {
        try {
            const response = await axiosInstance.put(`/admin/event-payouts/${id}/settle`, payload);
            return response.data?.result || response.data;
        } catch (error) {
            throw error.response?.data?.message || 'Failed to settle payout';
        }
    }
};
