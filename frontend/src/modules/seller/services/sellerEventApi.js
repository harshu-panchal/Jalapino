import axiosInstance from '@core/api/axios';

export const sellerEventApi = {
    // Get dashboard stats
    getDashboardStats: async () => {
        try {
            const response = await axiosInstance.get('/seller/events/dashboard');
            return response.data?.results || response.data?.data || response.data?.result || response.data;
        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
            throw error;
        }
    },

    // Get all reservations
    getReservations: async () => {
        try {
            const response = await axiosInstance.get('/seller/events/reservations');
            return response.data?.results || response.data?.data || response.data?.result || response.data || [];
        } catch (error) {
            console.error('Error fetching reservations:', error);
            throw error;
        }
    },

    // Update reservation status (Accept/Reject/Complete)
    updateReservationStatus: async (id, status) => {
        try {
            const response = await axiosInstance.put(`/seller/events/reservations/${id}/status`, { status });
            return response.data;
        } catch (error) {
            console.error('Error updating reservation status:', error);
            throw error;
        }
    }
};
