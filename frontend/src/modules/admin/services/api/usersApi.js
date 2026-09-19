import axiosInstance from '@core/api/axios';

/**
 * Admin user, seller, and reports endpoints.
 * Per-domain split (P4.5).
 */
export const adminUsersApi = {
    getStats: (params) => axiosInstance.get('/admin/stats', { params }),
    getReports: () => axiosInstance.get('/admin/reports'),

    getUsers: (params) => axiosInstance.get('/admin/users', { params }),
    getUserById: (id) => axiosInstance.get(`/admin/users/${id}`),

    getSellers: (params) => axiosInstance.get('/admin/sellers', { params }),
    getActiveSellers: (params) =>
        axiosInstance.get('/admin/sellers/active', { params }),
    getSellerLocations: (params) =>
        axiosInstance.get('/admin/sellers/locations', { params }),
    getPendingSellers: (params) =>
        axiosInstance.get('/admin/sellers/pending', { params }),
    getSellerById: (id) => axiosInstance.get(`/admin/sellers/${id}`),
    updateSeller: (id, payload) => axiosInstance.put(`/admin/sellers/${id}`, payload),
    updateSellerType: (id, payload) =>
        axiosInstance.patch(`/admin/sellers/${id}/type`, payload),
    approveSeller: (id, payload) => axiosInstance.patch(`/admin/sellers/approve/${id}`, payload),
    rejectSeller: (id, data) =>
        axiosInstance.delete(`/admin/sellers/reject/${id}`, { data }),
    bounceBackSeller: (id, data) =>
        axiosInstance.put(`/admin/sellers/bounce-back/${id}`, data),
    getSellerBookings: (id) => axiosInstance.get(`/admin/sellers/${id}/bookings`),
    reuploadSellerDocument: (id, formData) =>
        axiosInstance.put(`/admin/sellers/${id}/documents/reupload`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        }),
    approveSellerDocument: (id, documentKey, status = 'approved') =>
        axiosInstance.put(`/admin/sellers/${id}/documents/${documentKey}/approve`, { status }),
};

export default adminUsersApi;
