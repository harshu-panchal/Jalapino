import React, { useEffect, useState } from "react";
import Card from "@shared/components/ui/Card";
import Badge from "@shared/components/ui/Badge";
import Modal from "@shared/components/ui/Modal";
import { useToast } from "@shared/components/ui/Toast";
import {
  HiOutlinePlus,
  HiOutlineTrash,
  HiOutlinePhoto,
} from "react-icons/hi2";
import { adminFooterBannersApi } from "../services/api/footerBannersApi";
import { resolveImageUrl } from "@/core/utils/imageUtils";

const FooterBannersManagement = () => {
  const { showToast } = useToast();
  const [banners, setBanners] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    title: "",
    link: "",
    status: "active",
    image: null,
  });

  const loadBanners = async () => {
    setIsLoading(true);
    try {
      const res = await adminFooterBannersApi.getFooterBanners();
      const list = res.data.results || res.data.result || res.data;
      setBanners(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error(e);
      showToast("Failed to load footer banners", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBanners();
  }, []);

  const resetForm = () => {
    setFormData({
      title: "",
      link: "",
      status: "active",
      image: null,
    });
  };

  const openCreateModal = () => {
    if (banners.length >= 5) {
      showToast("Maximum limit of 5 footer banners reached. Please delete an existing banner first.", "error");
      return;
    }
    resetForm();
    setIsModalOpen(true);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData((prev) => ({ ...prev, image: file }));
    }
  };

  const handleSave = async () => {
    if (!formData.image) {
      showToast("Please select an image.", "error");
      return;
    }

    try {
      const fd = new FormData();
      fd.append("image", formData.image);
      if (formData.title) fd.append("title", formData.title);
      if (formData.link) fd.append("link", formData.link);
      fd.append("status", formData.status);

      await adminFooterBannersApi.createFooterBanner(fd);
      showToast("Footer banner created successfully", "success");
      setIsModalOpen(false);
      loadBanners();
    } catch (error) {
      console.error(error);
      const msg = error.response?.data?.message || "Failed to save banner";
      showToast(msg, "error");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this banner?")) return;
    try {
      await adminFooterBannersApi.deleteFooterBanner(id);
      showToast("Banner deleted successfully", "success");
      loadBanners();
    } catch (error) {
      console.error(error);
      showToast("Failed to delete banner", "error");
    }
  };

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Footer Banners ({banners.length}/5)
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Upload up to 5 banners to display in a scrolling carousel below the footer on the customer app.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          disabled={banners.length >= 5}
          className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <HiOutlinePlus className="w-5 h-5" />
          NEW BANNER
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {banners.map((banner) => (
            <Card key={banner._id} className="overflow-hidden flex flex-col relative group">
              <div className="aspect-[21/9] bg-slate-100 relative">
                <img
                  src={resolveImageUrl(banner.imageUrl)}
                  alt={banner.title || "Footer Banner"}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 right-2 flex gap-2">
                  <Badge
                    variant={banner.status === "active" ? "success" : "default"}
                    className="shadow-sm font-bold uppercase tracking-wider text-[10px]"
                  >
                    {banner.status}
                  </Badge>
                </div>
              </div>
              <div className="p-4 flex flex-col flex-1">
                <h3 className="font-bold text-slate-800 truncate">
                  {banner.title || "No Title"}
                </h3>
                <p className="text-sm text-slate-500 mt-1 truncate">
                  {banner.link || "No Link"}
                </p>
                <div className="mt-auto pt-4 flex gap-2">
                  <button
                    onClick={() => handleDelete(banner._id)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 font-medium text-sm transition-colors"
                  >
                    <HiOutlineTrash className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>
            </Card>
          ))}
          {banners.length === 0 && (
            <Card className="col-span-full p-12 flex flex-col items-center justify-center text-slate-400">
              <HiOutlinePhoto className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-lg font-medium text-slate-600">
                No footer banners yet
              </p>
              <p className="text-sm mt-1">
                Click "New Banner" to upload an image.
              </p>
            </Card>
          )}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Upload Footer Banner"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Banner Image <span className="text-red-500">*</span>
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="w-full p-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            />
            {formData.image && (
              <p className="text-xs text-green-600 mt-1 font-medium">Image selected: {formData.image.name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Title (Optional)
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              placeholder="E.g. Download our App"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Link URL (Optional)
            </label>
            <input
              type="text"
              value={formData.link}
              onChange={(e) => setFormData({ ...formData, link: e.target.value })}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3 mt-8 pt-4 border-t border-slate-100">
          <button
            onClick={() => setIsModalOpen(false)}
            className="flex-1 py-3 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!formData.image}
            className="flex-1 py-3 text-sm font-bold text-white bg-primary hover:bg-primary-dark rounded-xl transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
          >
            Upload Banner
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default FooterBannersManagement;
