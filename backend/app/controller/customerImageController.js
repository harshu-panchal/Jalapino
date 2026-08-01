import CustomerImage from "../models/customerImage.js";
import Seller from "../models/seller.js";
import handleResponse from "../utils/helper.js";

// Customer uploads an image
export const uploadCustomerImage = async (req, res) => {
  try {
    const { category } = req.body;
    
    if (!req.file || !category) {
      return handleResponse(res, 400, "Image and Category are required");
    }

    // Convert local path to a URL format (assuming static serving)
    const imageUrl = `/uploads/${req.file.filename}`;

    const newUpload = new CustomerImage({
      imageUrl,
      category,
      customer: req.user.id,
      status: "pending"
    });

    await newUpload.save();
    return handleResponse(res, 201, "Image uploaded successfully", newUpload);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// Seller/Admin views pending images in their queue
export const getPendingCustomerImages = async (req, res) => {
  try {
    const userRole = req.user.role; // 'admin' or 'seller'
    let query = { status: "pending" };

    if (userRole === "seller") {
      const seller = await Seller.findById(req.user.id);
      if (!seller) return handleResponse(res, 404, "Seller not found");
      
      // If seller doesn't have permission, they see nothing
      if (!seller.customerImageReviewEnabled) {
        return handleResponse(res, 200, "Pending customer images", []);
      }
      
      // Optionally filter by seller's category if they are only allowed to see their own category
      // query.category = seller.category; 
    }

    const images = await CustomerImage.find(query)
      .populate("customer", "name email phone")
      .sort({ createdAt: -1 });

    return handleResponse(res, 200, "Pending customer images", images);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// Seller/Admin approves an image
export const approveCustomerImage = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.user.role;

    const image = await CustomerImage.findById(id);
    if (!image) return handleResponse(res, 404, "Customer image not found");

    if (image.status !== "pending") {
      return handleResponse(res, 400, "Image has already been reviewed");
    }

    image.status = "approved";
    
    if (userRole === "seller") {
      image.approvedBySeller = req.user.id;
    } else {
      image.actionByAdmin = req.user.id;
    }

    await image.save();
    return handleResponse(res, 200, "Customer image approved successfully", image);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// Seller/Admin rejects an image
export const rejectCustomerImage = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.user.role;

    const image = await CustomerImage.findById(id);
    if (!image) return handleResponse(res, 404, "Customer image not found");

    if (image.status !== "pending") {
      return handleResponse(res, 400, "Image has already been reviewed");
    }

    // Usually rejecting means this seller won't do it, but other sellers might.
    // If the requirement is that rejecting removes it from the queue for EVERYONE, we set status to rejected.
    image.status = "rejected";
    
    if (userRole === "seller") {
      // In a real multi-seller queue, maybe we just track who rejected it instead of marking it rejected globally.
      // But for now, marking it rejected as requested.
    } else {
      image.actionByAdmin = req.user.id;
    }

    await image.save();
    return handleResponse(res, 200, "Customer image rejected successfully", image);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};
