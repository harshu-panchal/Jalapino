import axiosInstance from '@core/api/axios';

/**
 * Admin Refer & Earn campaign settings endpoints.
 */
export const adminReferralApi = {
    getReferralConfig: () => axiosInstance.get('/referral/admin/config'),
    updateReferralConfig: (data) => axiosInstance.put('/referral/admin/config', data),
    getReferralStats: () => axiosInstance.get('/referral/admin/stats'),
};

export default adminReferralApi;
