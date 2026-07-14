import SellerSignupBanner from "../models/sellerSignupBanner.js";
import handleResponse from "../utils/helper.js";
import { processAndSaveImage, deleteLocalFile } from "../services/localStorageService.js";
import logger from "../services/logger.js";

// @desc    Upload new banners
// @route   POST /api/admin/seller-signup-banners
// @access  Private/Admin
export const uploadBanners = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return handleResponse(res, 400, "No files uploaded");
    }

    if (req.files.length > 10) {
      return handleResponse(res, 400, "Maximum 10 images allowed at a time");
    }

    const savedBanners = [];
    let sortOrderCounter = await SellerSignupBanner.countDocuments();

    for (const file of req.files) {
      try {
        const imageUrl = await processAndSaveImage(file.buffer, "banners", file.originalname);
        
        const newBanner = new SellerSignupBanner({
          imageUrl,
          sortOrder: sortOrderCounter++,
        });
        
        const saved = await newBanner.save();
        savedBanners.push(saved);
      } catch (err) {
        logger.error(`Error processing image ${file.originalname}: ${err.message}`);
        // Continue processing other files
      }
    }

    return handleResponse(res, 201, "Banners uploaded successfully", savedBanners);
  } catch (error) {
    logger.error(`Error in uploadBanners: ${error.message}`);
    return handleResponse(res, 500, "Server Error");
  }
};

// @desc    Get all banners (Admin)
// @route   GET /api/admin/seller-signup-banners
// @access  Private/Admin
export const getAllBanners = async (req, res) => {
  try {
    const banners = await SellerSignupBanner.find().sort({ sortOrder: 1 });
    return handleResponse(res, 200, "Banners fetched successfully", banners);
  } catch (error) {
    logger.error(`Error in getAllBanners: ${error.message}`);
    return handleResponse(res, 500, "Server Error");
  }
};

// @desc    Get active banners (Public)
// @route   GET /api/seller/signup-banners
// @access  Public
export const getActiveBanners = async (req, res) => {
  try {
    const banners = await SellerSignupBanner.find({ isActive: true }).sort({ sortOrder: 1 });
    return handleResponse(res, 200, "Active banners fetched successfully", banners);
  } catch (error) {
    logger.error(`Error in getActiveBanners: ${error.message}`);
    return handleResponse(res, 500, "Server Error");
  }
};

// @desc    Delete banner
// @route   DELETE /api/admin/seller-signup-banners/:id
// @access  Private/Admin
export const deleteBanner = async (req, res) => {
  try {
    const banner = await SellerSignupBanner.findById(req.params.id);
    if (!banner) {
      return handleResponse(res, 404, "Banner not found");
    }

    // Delete image from local storage
    if (banner.imageUrl) {
      await deleteLocalFile(banner.imageUrl);
    }

    await SellerSignupBanner.findByIdAndDelete(req.params.id);

    return handleResponse(res, 200, "Banner deleted successfully");
  } catch (error) {
    logger.error(`Error in deleteBanner: ${error.message}`);
    return handleResponse(res, 500, "Server Error");
  }
};

// @desc    Update banner (e.g. toggle active status or update sorting)
// @route   PUT /api/admin/seller-signup-banners/:id
// @access  Private/Admin
export const updateBanner = async (req, res) => {
  try {
    const { isActive, sortOrder, width, height } = req.body;
    
    const banner = await SellerSignupBanner.findById(req.params.id);
    if (!banner) {
      return handleResponse(res, 404, "Banner not found");
    }

    if (isActive !== undefined) banner.isActive = isActive;
    if (sortOrder !== undefined) banner.sortOrder = sortOrder;
    if (width !== undefined) banner.width = width;
    if (height !== undefined) banner.height = height;

    const updatedBanner = await banner.save();

    return handleResponse(res, 200, "Banner updated successfully", updatedBanner);
  } catch (error) {
    logger.error(`Error in updateBanner: ${error.message}`);
    return handleResponse(res, 500, "Server Error");
  }
};
