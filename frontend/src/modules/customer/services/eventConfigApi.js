import axiosInstance from '@core/api/axios';

export const eventConfigApi = {
    // Get all active event types
    getEventTypes: async () => {
        try {
            const response = await axiosInstance.get('/event-config/types');
            return response.data?.results || response.data?.data || response.data || [];
        } catch (error) {
            console.error('Error fetching event types:', error);
            throw error;
        }
    },

    // Get active cities
    getCities: async () => {
        try {
            const response = await axiosInstance.get('/event-config/cities');
            return response.data?.results || response.data?.data || response.data || [];
        } catch (error) {
            console.error('Error fetching cities:', error);
            throw error;
        }
    },

    // Get all active event categories with their preference forms
    getEventCategories: async () => {
        try {
            const response = await axiosInstance.get('/event-config/categories');
            return response.data?.results || response.data?.data || response.data || [];
        } catch (error) {
            console.error('Error fetching event categories:', error);
            throw error;
        }
    },

    // Get forms and fields for specific categories
    getFormsForCategories: async (categoryIds) => {
        try {
            const queryParams = new URLSearchParams();
            categoryIds.forEach(id => queryParams.append('categories', id));
            
            const response = await axiosInstance.get(`/event-config/forms?${queryParams.toString()}`);
            return response.data?.result || [];
        } catch (error) {
            console.error("Error fetching category forms:", error);
            throw error;
        }
    },

    // Search for available sellers
    searchSellers: async (params) => {
        try {
            const queryParams = new URLSearchParams();
            if (params.date) queryParams.append('date', params.date);
            if (params.time) queryParams.append('time', params.time);
            if (params.guestCount) queryParams.append('guestCount', params.guestCount);
            if (params.location) queryParams.append('location', params.location);
            if (params.categories) queryParams.append('categories', params.categories.join(','));
            if (params.budget) queryParams.append('budget', params.budget);
            
            const response = await axiosInstance.get(`/events/sellers/search?${queryParams.toString()}`);
            return response.data?.result || [];
        } catch (error) {
            console.error("Error searching sellers:", error);
            throw error;
        }
    },

    // Upload media file
    uploadMedia: async (file) => {
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('folder', 'customer_preferences');
            const response = await axiosInstance.post('/media/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            return response.data?.url || response.data?.data?.url || response.data?.result?.url || response.data?.results?.url;
        } catch (error) {
            console.error("Error uploading media:", error);
            throw error;
        }
    }
};
