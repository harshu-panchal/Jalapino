import { apiClient } from "@/core/api/apiClient";

export const customerFooterBannersApi = {
  getFooterBanners: () => apiClient.get("/footer-banners"),
};
