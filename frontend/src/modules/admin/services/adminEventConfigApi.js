import axiosInstance from '@core/api/axios';

export const adminEventConfigApi = {
    // ---- Event Types ----
    getEventTypes: async () => {
        const response = await axiosInstance.get('/admin/event-config/types');
        return response.data?.results || response.data?.data || response.data || [];
    },
    createEventType: async (data) => {
        const response = await axiosInstance.post('/admin/event-config/types', data);
        return response.data;
    },
    updateEventType: async (id, data) => {
        const response = await axiosInstance.put(`/admin/event-config/types/${id}`, data);
        return response.data;
    },
    deleteEventType: async (id) => {
        const response = await axiosInstance.delete(`/admin/event-config/types/${id}`);
        return response.data;
    },

    // ---- Event Categories ----
    getEventCategories: async () => {
        const response = await axiosInstance.get('/admin/event-config/categories');
        return response.data?.results || response.data?.data || response.data || [];
    },
    createEventCategory: async (data) => {
        const response = await axiosInstance.post('/admin/event-config/categories', data);
        return response.data;
    },
    updateEventCategory: async (id, data) => {
        const response = await axiosInstance.put(`/admin/event-config/categories/${id}`, data);
        return response.data;
    },
    deleteEventCategory: async (id) => {
        const response = await axiosInstance.delete(`/admin/event-config/categories/${id}`);
        return response.data;
    },

    // ---- Package Templates ----
    getPackageTemplates: async () => {
        const response = await axiosInstance.get('/admin/event-config/package-templates');
        return response.data?.results || response.data?.data || response.data || [];
    },
    createPackageTemplate: async (data) => {
        const response = await axiosInstance.post('/admin/event-config/package-templates', data);
        return response.data;
    },
    updatePackageTemplate: async (id, data) => {
        const response = await axiosInstance.put(`/admin/event-config/package-templates/${id}`, data);
        return response.data;
    },
    deletePackageTemplate: async (id) => {
        const response = await axiosInstance.delete(`/admin/event-config/package-templates/${id}`);
        return response.data;
    },

    // ---- Media ----
    uploadIcon: async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', 'categories'); // Optional folder
        const response = await axiosInstance.post('/media/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data?.url || response.data?.data?.url || response.data?.result?.url || response.data?.results?.url;
    }
};
