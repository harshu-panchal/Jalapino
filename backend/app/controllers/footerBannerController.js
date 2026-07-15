import FooterBanner from "../models/FooterBanner.js";
import { processAndSaveImage, deleteLocalFile } from "../services/localStorageService.js";
import logger from "../services/logger.js";

// @desc    Get all footer banners
// @route   GET /api/footer-banners
// @access  Public / Admin
export const getFooterBanners = async (req, res) => {
  try {
    const filter = {};
    if (req.user?.role !== "admin") {
      filter.status = "active";
    }
    const banners = await FooterBanner.find(filter).sort({ order: 1 });
    res.json({ success: true, count: banners.length, results: banners });
  } catch (error) {
    logger.error("Error in getFooterBanners:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Create a new footer banner
// @route   POST /api/footer-banners
// @access  Admin
export const createFooterBanner = async (req, res) => {
  try {
    // Limit check
    const count = await FooterBanner.countDocuments();
    if (count >= 5) {
      return res.status(400).json({ success: false, message: "Maximum limit of 5 footer banners reached." });
    }

    let imageUrl = "";
    if (req.file) {
      const result = await processAndSaveImage(req.file.buffer, "banners", req.file.originalname);
      if (!result.success) {
        return res.status(500).json({ success: false, message: "Failed to upload image" });
      }
      imageUrl = result.url;
    } else {
      return res.status(400).json({ success: false, message: "Image is required" });
    }

    const { title, link, status } = req.body;

    const banner = await FooterBanner.create({
      title,
      link,
      status: status || "active",
      imageUrl,
      order: count,
    });

    res.status(201).json({ success: true, result: banner });
  } catch (error) {
    logger.error("Error in createFooterBanner:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Delete a footer banner
// @route   DELETE /api/footer-banners/:id
// @access  Admin
export const deleteFooterBanner = async (req, res) => {
  try {
    const banner = await FooterBanner.findById(req.params.id);
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
    logger.error("Error in deleteFooterBanner:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
