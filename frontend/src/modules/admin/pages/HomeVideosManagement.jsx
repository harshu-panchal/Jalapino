import React, { useEffect, useState } from "react";
import Card from "@shared/components/ui/Card";
import Modal from "@shared/components/ui/Modal";
import { useToast } from "@shared/components/ui/Toast";
import { adminApi } from "../services/adminApi";
import {
  HiOutlineFilm,
  HiOutlinePlus,
  HiOutlineTrash,
  HiOutlineArrowUpTray,
  HiOutlineLink,
} from "react-icons/hi2";
import { cn } from "@/lib/utils";

export default function HomeVideosManagement() {
  const { showToast } = useToast();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  // Form states
  const [videoFile, setVideoFile] = useState(null);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [linkType, setLinkType] = useState("none");
  const [linkValue, setLinkValue] = useState("");
  const [order, setOrder] = useState(0);

  // Dropdown lists
  const [allProducts, setAllProducts] = useState([]);
  const [allCategories, setAllCategories] = useState([]);

  const fetchVideos = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getHomeVideos();
      if (res.data?.success) {
        setVideos(res.data.result || []);
      }
    } catch (err) {
      showToast("Failed to fetch homepage videos", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadSelectionData = async () => {
    try {
      const [catsRes, prodsRes] = await Promise.all([
        adminApi.getCategoryTree(),
        adminApi.getProducts({ limit: 1000 }),
      ]);

      // Parse categories
      const tree = catsRes.data?.results || catsRes.data?.result || [];
      const flat = tree.flatMap((h) => (h.children || []).map((c) => ({ ...c, headerName: h.name })));
      setAllCategories(flat);

      // Parse products
      const rawProducts = prodsRes.data?.result;
      const prodList = Array.isArray(prodsRes.data?.results)
        ? prodsRes.data?.results
        : Array.isArray(rawProducts?.items)
        ? rawProducts.items
        : Array.isArray(rawProducts)
        ? rawProducts
        : [];
      setAllProducts(prodList);
    } catch (err) {
      console.error("Failed to load selectors data", err);
    }
  };

  useEffect(() => {
    fetchVideos();
    loadSelectionData();
  }, []);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!videoFile) {
      showToast("Please choose a video file", "warning");
      return;
    }

    const formData = new FormData();
    formData.append("video", videoFile);
    formData.append("title", title);
    formData.append("subtitle", subtitle);
    formData.append("linkType", linkType);
    formData.append("linkValue", linkValue);
    formData.append("order", order);

    setUploading(true);
    try {
      const res = await adminApi.createHomeVideo(formData);
      if (res.data?.success) {
        showToast("Video uploaded successfully!", "success");
        setModalOpen(false);
        // Reset form
        setVideoFile(null);
        setTitle("");
        setSubtitle("");
        setLinkType("none");
        setLinkValue("");
        setOrder(0);
        fetchVideos();
      }
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to upload video", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    try {
      const res = await adminApi.updateHomeVideo(id, { status: newStatus });
      if (res.data?.success) {
        showToast(`Video set to ${newStatus}`, "success");
        setVideos(videos.map((v) => (v._id === id ? { ...v, status: newStatus } : v)));
      }
    } catch (err) {
      showToast("Failed to toggle status", "error");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this video?")) return;
    try {
      const res = await adminApi.deleteHomeVideo(id);
      if (res.data?.success) {
        showToast("Video deleted successfully", "success");
        setVideos(videos.filter((v) => v._id !== id));
      }
    } catch (err) {
      showToast("Failed to delete video", "error");
    }
  };

  return (
    <div className="ds-section-spacing">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="ds-h1 flex items-center gap-2">
            <HiOutlineFilm className="h-6 w-6 text-primary" />
            Homepage Video Management
          </h1>
          <p className="ds-description mt-1">Upload and manage promotional videos displayed on the homepage.</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-bold text-xs rounded-xl shadow-sm hover:opacity-90 transition-all"
        >
          <HiOutlinePlus className="h-4 w-4" />
          Add Video
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-500 font-bold">Loading...</div>
      ) : videos.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-2 border-slate-200">
          <HiOutlineFilm className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-bold text-sm">No promotional videos uploaded yet.</p>
          <p className="text-xs text-slate-400 mt-1">Upload mp4 files to show dynamic video clips to app users.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {videos.map((vid) => (
            <Card key={vid._id} className="overflow-hidden bg-white border border-slate-100 flex flex-col justify-between">
              <div>
                <div className="aspect-video bg-black relative">
                  <video
                    src={vid.videoUrl}
                    className="w-full h-full object-cover"
                    controls
                    preload="metadata"
                  />
                  <div className="absolute top-3 right-3 flex items-center gap-1.5">
                    <span
                      onClick={() => handleToggleStatus(vid._id, vid.status)}
                      className={cn(
                        "px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-full cursor-pointer shadow-sm select-none transition-all",
                        vid.status === "active"
                          ? "bg-emerald-500 text-white"
                          : "bg-slate-400 text-white"
                      )}
                    >
                      {vid.status}
                    </span>
                  </div>
                </div>

                <div className="p-4 space-y-2">
                  <h3 className="text-sm font-black text-slate-800 leading-tight">
                    {vid.title || "Unnamed Video"}
                  </h3>
                  {vid.subtitle && (
                    <p className="text-xs font-medium text-slate-400">{vid.subtitle}</p>
                  )}

                  <div className="flex items-center gap-1.5 pt-2 text-[10px] font-bold text-slate-500 border-t border-slate-100 mt-3">
                    <HiOutlineLink className="h-3.5 w-3.5" />
                    <span>Link:</span>
                    <span className="text-primary uppercase tracking-wide">
                      {vid.linkType !== "none" ? vid.linkType : "No Link"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400">Order: {vid.order}</span>
                <button
                  onClick={() => handleDelete(vid._id)}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                >
                  <HiOutlineTrash className="h-4 w-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => !uploading && setModalOpen(false)}
        title="Upload Promotional Video"
        size="lg"
        footer={
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setModalOpen(false)}
              disabled={uploading}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {uploading ? "Uploading Video…" : "Upload"}
            </button>
          </div>
        }
      >
        <form onSubmit={handleUpload} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Video File (MP4 format)</label>
            <div className="flex items-center justify-center w-full">
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-200 border-dashed rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100/50 transition-all">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <HiOutlineArrowUpTray className="w-8 h-8 text-slate-400 mb-2" />
                  <p className="text-xs text-slate-500 font-bold">
                    {videoFile ? videoFile.name : "Click to upload video file"}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">MP4, WebM (Max 50MB)</p>
                </div>
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => setVideoFile(e.target.files[0])}
                />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Title (optional)</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-2.5 bg-slate-50 rounded-xl text-xs font-semibold border-none outline-none focus:ring-1 focus:ring-slate-200"
                placeholder="Promo title"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Subtitle (optional)</label>
              <input
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                className="w-full p-2.5 bg-slate-50 rounded-xl text-xs font-semibold border-none outline-none focus:ring-1 focus:ring-slate-200"
                placeholder="Promo description"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Link Type</label>
              <select
                value={linkType}
                onChange={(e) => {
                  setLinkType(e.target.value);
                  setLinkValue("");
                }}
                className="w-full p-2.5 bg-slate-50 rounded-xl text-xs font-bold border-none outline-none cursor-pointer"
              >
                <option value="none">No Link</option>
                <option value="product">Link Product</option>
                <option value="category">Link Category</option>
                <option value="url">External Link</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Link Value</label>
              {linkType === "product" ? (
                <select
                  value={linkValue}
                  onChange={(e) => setLinkValue(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 rounded-xl text-xs font-bold border-none outline-none cursor-pointer"
                >
                  <option value="">Select Product...</option>
                  {allProducts.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              ) : linkType === "category" ? (
                <select
                  value={linkValue}
                  onChange={(e) => setLinkValue(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 rounded-xl text-xs font-bold border-none outline-none cursor-pointer"
                >
                  <option value="">Select Category...</option>
                  {allCategories.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name} {c.headerName ? `(${c.headerName})` : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={linkValue}
                  onChange={(e) => setLinkValue(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 rounded-xl text-xs font-semibold border-none outline-none focus:ring-1 focus:ring-slate-200"
                  placeholder={
                    linkType === "url"
                      ? "Enter URL (https://...)"
                      : "No Link Value needed"
                  }
                  disabled={linkType === "none"}
                />
              )}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-bold">Display Order</label>
            <input
              type="number"
              value={order}
              onChange={(e) => setOrder(Number(e.target.value) || 0)}
              className="w-24 p-2.5 bg-slate-50 rounded-xl text-xs font-bold border-none outline-none"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
