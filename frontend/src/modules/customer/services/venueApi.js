import axiosInstance from '@core/api/axios';

export const venueApi = {
    searchVenues: (params) => axiosInstance.get('/venues/search', { params }),
    createVisitRequests: (data) => axiosInstance.post('/venues/visit-requests', data),
    getVisitRequestsMine: () => axiosInstance.get('/venues/visit-requests/mine'),
    updateVisitRequestStatus: (id, data) => axiosInstance.patch(`/venues/visit-requests/${id}/status`, data),
    getVenueAvailability: (params) => axiosInstance.get('/venues/availability', { params }),
};
