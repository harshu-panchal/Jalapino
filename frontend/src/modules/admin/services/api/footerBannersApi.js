import axiosInstance from '@core/api/axios';

export const adminFooterBannersApi = {
  getFooterBanners: () => axiosInstance.get("/footer-banners"),
  createFooterBanner: (formData) =>
    axiosInstance.post("/footer-banners", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  deleteFooterBanner: (id) => axiosInstance.delete(`/footer-banners/${id}`),
};
