import axiosInstance from "@core/api/axios";
import { getWithDedupe } from "@core/api/dedupe";

export const customerCateringApi = {
  // Get active services
  getServices: (params) => getWithDedupe("/catering/services", params, { ttl: 60 * 1000 }),

  // Get active packages
  getPackages: (params) => getWithDedupe("/catering/packages", params, { ttl: 60 * 1000 }),

  // Submit a booking request
  submitBooking: (data) => axiosInstance.post("/catering/bookings", data),
};
