import axiosInstance from '@core/api/axios';

export const adminCateringApi = {
    // Services
    getCateringServices: (params) => axiosInstance.get('/catering/admin/services', { params }),
    createCateringService: (data) => axiosInstance.post('/catering/admin/services', data),
    updateCateringService: (id, data) => axiosInstance.put(`/catering/admin/services/${id}`, data),
    deleteCateringService: (id) => axiosInstance.delete(`/catering/admin/services/${id}`),

    // Packages
    getCateringPackages: (params) => axiosInstance.get('/catering/admin/packages', { params }),
    createCateringPackage: (data) => axiosInstance.post('/catering/admin/packages', data),
    updateCateringPackage: (id, data) => axiosInstance.put(`/catering/admin/packages/${id}`, data),
    deleteCateringPackage: (id) => axiosInstance.delete(`/catering/admin/packages/${id}`),

    // Bookings
    getCateringBookings: (params) => axiosInstance.get('/catering/admin/bookings', { params }),
    getCateringBookingDetails: (id) => axiosInstance.get(`/catering/admin/bookings/${id}`),
    updateCateringBookingStatus: (id, data) => axiosInstance.put(`/catering/admin/bookings/${id}/status`, data),
    updateCateringPaymentStatus: (id, data) => axiosInstance.put(`/catering/admin/bookings/${id}/payment`, data),

    // Payments
    createRazorpayOrder: (data) => axiosInstance.post('/catering/admin/payments/razorpay/create-order', data),
    verifyRazorpayPayment: (data) => axiosInstance.post('/catering/admin/payments/razorpay/verify', data),

    // Dashboard
    getCateringDashboardStats: () => axiosInstance.get('/catering/admin/dashboard'),
};

export default adminCateringApi;
