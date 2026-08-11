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
import { adminEventConfigApi } from "../services/adminEventConfigApi";
import { resolveImageUrl } from "@/core/utils/imageUtils";

const EventBannersManagement = () => {
  const { showToast } = useToast();
  const [banners, setBanners] = useState([]);
  const [selectedModule, setSelectedModule] = useState("plan_my_event");
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);

  const loadBanners = async () => {
    setIsLoading(true);
    try {
      const list = await adminEventConfigApi.getEventBanners(selectedModule);
      setBanners(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error(e);
      showToast("Failed to load event banners", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBanners();
  }, [selectedModule]);

  const openCreateModal = () => {
    if (banners.length >= 5) {
      showToast("Maximum limit of 5 event banners reached. Please delete an existing banner first.", "error");
      return;
    }
    setSelectedFiles([]);
    setIsModalOpen(true);
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    const availableSlots = 5 - banners.length;
    
    if (files.length > availableSlots) {
      showToast(`You can only select up to ${availableSlots} more image(s).`, "error");
      e.target.value = "";
      setSelectedFiles([]);
      return;
    }

    setSelectedFiles(files);
  };

  const handleSave = async () => {
    if (selectedFiles.length === 0) {
      showToast("Please select at least one image.", "error");
      return;
    }

    try {
      setIsLoading(true);
      await adminEventConfigApi.uploadEventBanners(selectedFiles, selectedModule);
      showToast("Event banners uploaded successfully", "success");
      setIsModalOpen(false);
      loadBanners();
    } catch (error) {
      console.error(error);
      const msg = error.response?.data?.message || "Failed to upload banners";
      showToast(msg, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this event banner?")) return;
    try {
      setIsLoading(true);
      await adminEventConfigApi.deleteEventBanner(id);
      showToast("Banner deleted successfully", "success");
      loadBanners();
    } catch (error) {
      console.error(error);
      showToast("Failed to delete banner", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 capitalize">
            {selectedModule.replace(/_/g, " ")} Banners ({banners.length}/5)
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Upload up to 5 banners to display in a carousel at the top of the selected page.
          </p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value)}
            className="p-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm font-semibold bg-white cursor-pointer"
          >
            <option value="plan_my_event">Plan My Event</option>
            <option value="retail">Retail</option>
            <option value="wholesale">Wholesale</option>
          </select>
          <button
            onClick={openCreateModal}
            disabled={banners.length >= 5}
            className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            <HiOutlinePlus className="w-5 h-5" />
            UPLOAD BANNERS
          </button>
        </div>
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
                  alt={banner.title || "Event Banner"}
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
                  {banner.title || `Event Banner #${banner.order + 1}`}
                </h3>
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
                No event banners yet
              </p>
              <p className="text-sm mt-1">
                Click "Upload Banners" to add images.
              </p>
            </Card>
          )}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Upload ${selectedModule === 'plan_my_event' ? 'Plan My Event' : selectedModule === 'retail' ? 'Retail' : 'Wholesale'} Banners`}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Select Images <span className="text-red-500">*</span>
            </label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              className="w-full p-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            />
            <p className="text-xs text-slate-400 mt-1">
              You can select multiple images (up to {5 - banners.length} image(s)).
            </p>
            {selectedFiles.length > 0 && (
              <div className="mt-3 space-y-1">
                <p className="text-xs font-bold text-slate-700">Selected files:</p>
                {selectedFiles.map((file, idx) => (
                  <p key={idx} className="text-xs text-green-600 font-medium">
                    ✓ {file.name}
                  </p>
                ))}
              </div>
            )}
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
            disabled={selectedFiles.length === 0}
            className="flex-1 py-3 text-sm font-bold text-white bg-primary hover:bg-primary-dark rounded-xl transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
          >
            Upload ({selectedFiles.length}) Banners
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default EventBannersManagement;
