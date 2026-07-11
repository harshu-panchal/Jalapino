import HomeVideo from "../models/homeVideo.js";
import { saveRawFile, deleteLocalFile } from "../services/localStorageService.js";
import handleResponse from "../utils/helper.js";

const rewriteImageUrl = (url) => {
  if (!url) return url;
  const idx = url.indexOf("/images/");
  if (idx !== -1) {
    const relative = url.substring(idx);
    const isLocal = process.platform === "win32";
    const activeDomain = process.env.API_DOMAIN || (isLocal ? "http://localhost:7000" : "https://jalpaino.com/api");
    return `${activeDomain}${relative}`;
  }
  return url;
};

// Admin: Upload video using Multer and save to DB
export const uploadVideo = async (req, res) => {
  try {
    if (!req.file) {
      return handleResponse(res, 400, "Video file is required");
    }

    const { title = "", subtitle = "", linkType = "none", linkValue = "", order = 0 } = req.body;

    // Save locally
    const url = await saveRawFile(req.file.buffer, "videos", req.file.originalname);

    const video = new HomeVideo({
      videoUrl: url,
      title: title.trim(),
      subtitle: subtitle.trim(),
      linkType,
      linkValue: linkValue.trim(),
      status: "active",
      order: Number(order) || 0,
    });

    const saved = await video.save();
    return handleResponse(res, 201, "Video uploaded successfully", {
      ...saved.toObject(),
      videoUrl: rewriteImageUrl(saved.videoUrl),
    });
  } catch (error) {
    console.error("Failed to upload video:", error);
    return handleResponse(res, 500, error.message);
  }
};

// Admin: Get all videos
export const getAdminVideos = async (req, res) => {
  try {
    const list = await HomeVideo.find().sort({ order: 1, createdAt: -1 }).lean();
    const normalized = list.map((v) => ({
      ...v,
      videoUrl: rewriteImageUrl(v.videoUrl),
    }));
    return handleResponse(res, 200, "Admin videos fetched", normalized);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// Public: Get active videos
export const getPublicVideos = async (req, res) => {
  try {
    const list = await HomeVideo.find({ status: "active" }).sort({ order: 1, createdAt: -1 }).lean();
    const normalized = list.map((v) => ({
      ...v,
      videoUrl: rewriteImageUrl(v.videoUrl),
    }));
    return handleResponse(res, 200, "Videos fetched successfully", normalized);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// Admin: Update metadata
export const updateVideo = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, subtitle, linkType, linkValue, status, order } = req.body;

    const updated = await HomeVideo.findByIdAndUpdate(
      id,
      {
        ...(title !== undefined ? { title: title.trim() } : {}),
        ...(subtitle !== undefined ? { subtitle: subtitle.trim() } : {}),
        ...(linkType !== undefined ? { linkType } : {}),
        ...(linkValue !== undefined ? { linkValue: linkValue.trim() } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(order !== undefined ? { order: Number(order) || 0 } : {}),
      },
      { new: true }
    ).lean();

    if (!updated) {
      return handleResponse(res, 404, "Video not found");
    }

    return handleResponse(res, 200, "Video updated successfully", {
      ...updated,
      videoUrl: rewriteImageUrl(updated.videoUrl),
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// Admin: Delete video record & file
export const deleteVideo = async (req, res) => {
  try {
    const { id } = req.params;
    const video = await HomeVideo.findById(id);
    if (!video) {
      return handleResponse(res, 404, "Video not found");
    }

    // Delete local file
    try {
      await deleteLocalFile(video.videoUrl);
    } catch (err) {
      console.warn("Could not delete physical video file:", err.message);
    }

    await HomeVideo.findByIdAndDelete(id);
    return handleResponse(res, 200, "Video deleted successfully");
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};
