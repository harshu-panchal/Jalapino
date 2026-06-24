import axiosInstance from '@core/api/axios';

export const sellerCalendarApi = {
    getCalendarConfig: async () => {
        try {
            const response = await axiosInstance.get('/seller/calendar');
            return response.data.result;
        } catch (error) {
            throw error.response?.data?.message || 'Failed to fetch calendar';
        }
    },
    
    updateBlockedDates: async (blockedDates) => {
        try {
            const response = await axiosInstance.put('/seller/calendar/blocked-dates', { blockedDates });
            return response.data.result;
        } catch (error) {
            throw error.response?.data?.message || 'Failed to update blocked dates';
        }
    }
};
