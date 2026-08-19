import axiosInstance from '@core/api/axios';

export const videoSubscriptionApi = {
    getPlans: () => axiosInstance.get('/admin/video-subscriptions').then(res => res.data),
    createPlan: (data) => axiosInstance.post('/admin/video-subscriptions', data).then(res => res.data),
    updatePlan: (id, data) => axiosInstance.put(`/admin/video-subscriptions/${id}`, data).then(res => res.data),
    deletePlan: (id) => axiosInstance.delete(`/admin/video-subscriptions/${id}`).then(res => res.data),
    getSubscriptions: () => axiosInstance.get('/admin/video-subscriptions/subscriptions').then(res => res.data),
    confirmCODSubscription: (id) => axiosInstance.patch(`/admin/video-subscriptions/subscriptions/${id}/confirm-cod`).then(res => res.data),
};

