import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Edit2, Loader2, Image as ImageIcon, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import adminContentApi from "../services/api/contentApi";

const SellerSignupBanners = () => {
  const [banners, setBanners] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  
  // Edit Dimensions State
  const [editingId, setEditingId] = useState(null);
  const [editWidth, setEditWidth] = useState("");
  const [editHeight, setEditHeight] = useState("");

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    try {
      const response = await adminContentApi.getSellerSignupBanners();
      setBanners(response.data.results || response.data.result || []);
    } catch (error) {
      toast.error("Failed to fetch banners");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (!files.length) return;

    if (files.length > 10) {
      toast.error("You can only upload up to 10 images at once");
      return;
    }

    const formData = new FormData();
    files.forEach((file) => {
      formData.append("images", file);
    });

    setIsUploading(true);
    try {
      await adminContentApi.uploadSellerSignupBanners(formData);
      toast.success("Banners uploaded successfully");
      fetchBanners();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to upload banners");
    } finally {
      setIsUploading(false);
      // Reset input
      event.target.value = null;
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this banner?")) return;
    
    try {
      await adminContentApi.deleteSellerSignupBanner(id);
      toast.success("Banner deleted");
      setBanners(banners.filter(b => b._id !== id));
    } catch (error) {
      toast.error("Failed to delete banner");
    }
  };

  const toggleActive = async (banner) => {
    try {
      const newStatus = !banner.isActive;
      await adminContentApi.updateSellerSignupBanner(banner._id, { isActive: newStatus });
      toast.success(newStatus ? "Banner activated" : "Banner deactivated");
      setBanners(banners.map(b => b._id === banner._id ? { ...b, isActive: newStatus } : b));
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const handleEditDimensions = (banner) => {
    setEditingId(banner._id);
    setEditWidth(banner.width || "100%");
    setEditHeight(banner.height || "100%");
  };

  const saveDimensions = async (id) => {
    try {
      await adminContentApi.updateSellerSignupBanner(id, { width: editWidth, height: editHeight });
      toast.success("Dimensions updated");
      setBanners(banners.map(b => b._id === id ? { ...b, width: editWidth, height: editHeight } : b));
      setEditingId(null);
    } catch (error) {
      toast.error("Failed to update dimensions");
    }
  };

  const getImageUrl = (path) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    const domain = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:7000';
    return `${domain}${path.startsWith('/') ? '' : '/'}${path}`;
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Seller Signup Banners</h1>
          <p className="text-slate-500 text-sm mt-1">
            Manage the slideshow images shown on the Seller Signup/Login page. You can upload up to 10 images at once.
          </p>
        </div>
        <div className="relative shrink-0">
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileUpload}
            disabled={isUploading}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          />
          <button
            disabled={isUploading}
            className="flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50 w-full sm:w-auto"
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            <span>Upload Images</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <AnimatePresence>
          {banners.map((banner) => (
            <motion.div
              key={banner._id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md"
            >
              <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100 relative">
                {banner.imageUrl ? (
                  <img
                    src={getImageUrl(banner.imageUrl)}
                    alt="Banner"
                    className={`h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 ${!banner.isActive ? 'grayscale opacity-60' : ''}`}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <ImageIcon className="h-10 w-10 text-slate-300" />
                  </div>
                )}
                
                {/* Overlay actions */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                  <button
                    onClick={() => toggleActive(banner)}
                    className="p-2 bg-white rounded-full text-slate-700 hover:text-brand-600 shadow-sm"
                    title={banner.isActive ? "Deactivate" : "Activate"}
                  >
                    {banner.isActive ? <XCircle size={18} /> : <CheckCircle size={18} />}
                  </button>
                  <button
                    onClick={() => handleEditDimensions(banner)}
                    className="p-2 bg-white rounded-full text-slate-700 hover:text-blue-600 shadow-sm"
                    title="Edit Dimensions"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(banner._id)}
                    className="p-2 bg-white rounded-full text-slate-700 hover:text-red-600 shadow-sm"
                    title="Delete"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              
              <div className="p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`h-2.5 w-2.5 rounded-full ${banner.isActive ? 'bg-green-500' : 'bg-slate-300'}`} />
                    <span className="text-sm font-medium text-slate-700">
                      {banner.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">Order: {banner.sortOrder}</span>
                </div>

                {editingId === banner._id ? (
                  <div className="flex flex-col gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-medium text-slate-600 w-12">W:</label>
                      <input 
                        type="text" 
                        value={editWidth} 
                        onChange={(e) => setEditWidth(e.target.value)} 
                        onKeyDown={(e) => e.key === 'Enter' && saveDimensions(banner._id)}
                        className="flex-1 text-xs p-1 border border-slate-300 rounded focus:outline-none focus:border-slate-500"
                        placeholder="e.g. 100%, 500px"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-medium text-slate-600 w-12">H:</label>
                      <input 
                        type="text" 
                        value={editHeight} 
                        onChange={(e) => setEditHeight(e.target.value)} 
                        onKeyDown={(e) => e.key === 'Enter' && saveDimensions(banner._id)}
                        className="flex-1 text-xs p-1 border border-slate-300 rounded focus:outline-none focus:border-slate-500"
                        placeholder="e.g. 100%, auto"
                      />
                    </div>
                    <div className="flex gap-2 justify-end mt-1">
                      <button onClick={() => setEditingId(null)} className="text-xs px-2 py-1 text-slate-600 hover:bg-slate-200 rounded font-medium">Cancel</button>
                      <button onClick={() => saveDimensions(banner._id)} className="text-xs px-3 py-1 bg-slate-900 text-white rounded hover:bg-slate-800 font-medium transition-colors">Save</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>W: {banner.width || '100%'}</span>
                    <span>H: {banner.height || '100%'}</span>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {banners.length === 0 && !isLoading && (
          <div className="col-span-full py-12 flex flex-col items-center justify-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <ImageIcon className="h-12 w-12 text-slate-300 mb-3" />
            <h3 className="text-sm font-medium text-slate-700">No Banners Found</h3>
            <p className="text-xs text-slate-500 mt-1">Upload images to show them on the seller signup page.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SellerSignupBanners;
