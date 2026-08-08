import axiosInstance from '@core/api/axios';

export const generalBookingApi = {
    createBooking: (data) => axiosInstance.post('/general-booking/create', data),
    verifyPayment: (data) => axiosInstance.post('/general-booking/verify', data),
    getMyTickets: () => axiosInstance.get('/general-booking/my-tickets'),
    updateTicketDetails: (id, data) => axiosInstance.put(`/general-booking/tickets/${id}`, data),
    cancelTicket: (id) => axiosInstance.put(`/general-booking/tickets/${id}/cancel`),
    
    // Seller side
    scanTicket: (data) => axiosInstance.post('/seller/general-booking/scan', data),
    getSellerBookings: () => axiosInstance.get('/seller/general-booking/bookings'),
};
