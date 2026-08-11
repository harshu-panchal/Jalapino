import EventBanner from "../models/EventBanner.js";
import { processAndSaveImage, deleteLocalFile } from "../services/localStorageService.js";
import logger from "../services/logger.js";

// @desc    Get all active event banners
// @route   GET /api/event-banners
// @access  Public / Admin
export const getEventBanners = async (req, res) => {
  try {
    const { module = "plan_my_event" } = req.query;
    let filter = {};
    if (module === "plan_my_event") {
      filter.$or = [
        { module: "plan_my_event" },
        { module: { $exists: false } },
        { module: null }
      ];
    } else {
      filter.module = module;
    }
    if (req.user?.role !== "admin") {
      filter.status = "active";
    }
    const banners = await EventBanner.find(filter).sort({ order: 1 });
    res.json({ success: true, count: banners.length, results: banners });
  } catch (error) {
    logger.error("Error in getEventBanners:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Create new event banners (enforces limit of 5 max)
// @route   POST /api/event-banners
// @access  Admin
export const createEventBanners = async (req, res) => {
  try {
    const { module = "plan_my_event" } = req.body;
    const existingCount = await EventBanner.countDocuments({ module });
    const uploadCount = req.files ? req.files.length : 0;

    if (existingCount + uploadCount > 5) {
      return res.status(400).json({
        success: false,
        message: `Maximum limit of 5 banners for module '${module}' reached. Current: ${existingCount}, uploading: ${uploadCount}.`,
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: "At least one image is required" });
    }

    const createdBanners = [];
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      try {
        const imageUrl = await processAndSaveImage(file.buffer, "banners", file.originalname);
        const banner = await EventBanner.create({
          imageUrl,
          order: existingCount + i,
          status: "active",
          module,
        });
        createdBanners.push(banner);
      } catch (uploadError) {
        logger.error(`Error in event banner upload loop: ${uploadError.message}`);
        // Rollback uploaded files
        for (const banner of createdBanners) {
          if (banner.imageUrl && banner.imageUrl.startsWith("/storage/")) {
            const key = banner.imageUrl.replace("/storage/", "");
            await deleteLocalFile(key);
          }
        }
        return res.status(500).json({ success: false, message: "Failed to upload one or more images" });
      }
    }

    res.status(201).json({ success: true, results: createdBanners });
  } catch (error) {
    logger.error("Error in createEventBanners:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Delete an event banner
// @route   DELETE /api/event-banners/:id
// @access  Admin
export const deleteEventBanner = async (req, res) => {
  try {
    const banner = await EventBanner.findById(req.params.id);
    if (!banner) {
      return res.status(404).json({ success: false, message: "Banner not found" });
    }

    if (banner.imageUrl && banner.imageUrl.startsWith("/storage/")) {
      const key = banner.imageUrl.replace("/storage/", "");
      await deleteLocalFile(key);
    }

    await banner.deleteOne();
    res.json({ success: true, message: "Banner deleted successfully" });
  } catch (error) {
    logger.error("Error in deleteEventBanner:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
