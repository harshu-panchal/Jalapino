import axiosInstance from '@core/api/axios';

export const sellerApi = {
    login: (data) => axiosInstance.post('/seller/login', data),
    signup: (data) => axiosInstance.post('/seller/signup', data),
    forgotPassword: (data) => axiosInstance.post('/seller/forgot-password', data),
    resetPassword: (data) => axiosInstance.post('/seller/reset-password', data),
    getSignupBanners: () => axiosInstance.get('/seller-signup-banners'),
    sendVerificationOtp: (data) => axiosInstance.post('/seller/verification/send-otp', data),
    verifyVerificationOtp: (data) => axiosInstance.post('/seller/verification/verify-otp', data),
    // Advance Bookings
    getAdvanceBookings: (params) => axiosInstance.get('/seller/advance-bookings', { params }),
    acceptAdvanceBooking: (id) => axiosInstance.patch(`/seller/advance-bookings/${id}/accept`),
    completeDecoration: (id) => axiosInstance.patch(`/seller/advance-bookings/${id}/decoration-complete`),
    
    // Booking Management (Online/Offline)
    getBookings: (params) => axiosInstance.get('/seller/bookings', { params }),
    createBooking: (data) => axiosInstance.post('/seller/bookings', data),
    updateBookingDetails: (id, data) => axiosInstance.patch(`/seller/bookings/${id}`, data),
    deleteBookingDetails: (id) => axiosInstance.delete(`/seller/bookings/${id}`),
    requestPhysicalVisit: (id) => axiosInstance.patch(`/seller/bookings/${id}/request-visit`),
    confirmPhysicalVisit: (id) => axiosInstance.patch(`/seller/bookings/${id}/confirm-visit`),
    completePhysicalVisit: (id) => axiosInstance.patch(`/seller/bookings/${id}/complete-visit`),
    submitCustomerReview: (id, data) => axiosInstance.post(`/seller/bookings/${id}/submit-seller-review`, data),
    getCancellationPolicies: () => axiosInstance.get('/seller/cancellation-policies'),
    updateCancellationPolicies: (data) => axiosInstance.put('/seller/cancellation-policies', data),
    cancelBooking: (id) => axiosInstance.post(`/seller/bookings/${id}/cancel`),
    
    // Products
    getProducts: (params) => axiosInstance.get('/products/seller/me', { params }),
    getProductById: (id) => axiosInstance.get(`/products/${id}`),
    createProduct: (data) => axiosInstance.post('/products', data),
    updateProduct: (id, data) => axiosInstance.put(`/products/${id}`, data),
    deleteProduct: (id) => axiosInstance.delete(`/products/${id}`),

    // Categories (Public)
    getCategories: () => axiosInstance.get('/categories'),
    getCategoryTree: () => axiosInstance.get('/admin/categories?tree=true'),
    getActiveHsns: () => axiosInstance.get('/hsn/active'),

    // Others
    getStats: (range) => axiosInstance.get('/seller/stats', { params: { range } }),
    getOrders: (params) => axiosInstance.get('/orders/seller-orders', { params }),
    updateOrderStatus: (orderId, data) => axiosInstance.put(`/orders/status/${orderId}`, data),
    getEarnings: () => axiosInstance.get('/seller/earnings'),
    getWalletSummary: () => axiosInstance.get('/seller/wallet/summary'),
    getProfile: () => axiosInstance.get('/seller/profile'),
    updateProfile: (data) => axiosInstance.put('/seller/profile', data),

    // Stock
    adjustStock: (data) => axiosInstance.post('/products/adjust-stock', data),
    getStockHistory: () => axiosInstance.get('/products/stock-history'),

    // Notifications
    getNotifications: () => axiosInstance.get('/notifications'),
    markNotificationRead: (id) => axiosInstance.put(`/notifications/${id}/read`),
    markAllNotificationsRead: () => axiosInstance.put('/notifications/mark-all-read'),

    // Money Requests
    requestWithdrawal: (data) => axiosInstance.post('/seller/request-withdrawal', data),

    // Returns
    getReturns: (params) => axiosInstance.get('/orders/seller-returns', { params }),
    getReturnDetails: (orderId) => axiosInstance.get(`/orders/${orderId}/returns`),
    approveReturn: (orderId, data) => axiosInstance.put(`/orders/returns/${orderId}/approve`, data),
    rejectReturn: (orderId, data) => axiosInstance.put(`/orders/returns/${orderId}/reject`, data),
    assignReturnDelivery: (orderId, data) => axiosInstance.put(`/orders/returns/${orderId}/assign-delivery`, data),

    // Event Requests
    getEventRequests: () => axiosInstance.get('/seller/event-requests'),
    updateEventRequestStatus: (id, data) => axiosInstance.put(`/seller/event-requests/${id}/status`, data),

    // Live Kitchen
    updateLiveStreamUrl: (orderId, streamUrl) => axiosInstance.post('/kitchen/stream', { orderId, streamUrl }),
    uploadLiveStreamVideo: (formData) => axiosInstance.post('/kitchen/stream/upload', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    }),

    // Customer Images
    approveCustomerImage: (id) => axiosInstance.put(`/customer-images/${id}/approve`),
    rejectCustomerImage: (id) => axiosInstance.put(`/customer-images/${id}/reject`),

    // Venue Physical Visits
    getVisitRequests: () => axiosInstance.get('/seller/venues/visit-requests'),
    updateVisitRequestStatus: (id, data) => axiosInstance.patch(`/venues/visit-requests/${id}/status`, data),
    getVenueAvailability: (params) => axiosInstance.get('/venues/availability', { params }),
    setVenueAvailability: (data) => axiosInstance.post('/venues/availability', data),

    // Video Subscriptions & Uploads
    getVideoPlans: () => axiosInstance.get('/product-videos/plans'),
    createSubscriptionOrder: (data) => axiosInstance.post('/product-videos/subscribe/create-order', data),
    subscribeVideoPlan: (data) => axiosInstance.post('/product-videos/subscribe', data),
    checkVideoUploadIntent: (data) => axiosInstance.post('/product-videos/check-intent', data),
    uploadVideo: (data) => axiosInstance.post('/product-videos/upload', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
    })
};
