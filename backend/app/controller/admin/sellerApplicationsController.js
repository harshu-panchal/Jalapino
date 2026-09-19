import handleResponse from "../../utils/helper.js";
import getPagination from "../../utils/pagination.js";
import {
  approveSellerApplicationById,
  getPendingSellerApplications,
  rejectSellerApplicationById,
  bounceBackSellerApplicationById,
} from "../../services/admin/sellerApplicationService.js";
import Seller from "../../models/seller.js";
import { saveRawFile } from "../../services/localStorageService.js";

export const getPendingSellers = async (req, res) => {
  try {
    const { q = "", status = "pending" } = req.query;
    const { page, limit, skip } = getPagination(req, {
      defaultLimit: 25,
      maxLimit: 100,
    });

    const data = await getPendingSellerApplications({
      q,
      status,
      page,
      limit,
      skip,
    });

    return handleResponse(res, 200, "Pending seller applications fetched", data);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const approveSellerApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const { permissions } = req.body || {};
    const seller = await approveSellerApplicationById({
      sellerId: id,
      reviewedBy: req.user.id,
      permissions,
    });

    if (!seller) {
      return handleResponse(res, 404, "Seller not found");
    }

    return handleResponse(res, 200, "Seller approved successfully", seller);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const rejectSellerApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, adminRemark, adminTerms } = req.body;
    const seller = await rejectSellerApplicationById({
      sellerId: id,
      reviewedBy: req.user.id,
      reason,
      adminRemark,
      adminTerms,
    });

    if (!seller) {
      return handleResponse(res, 404, "Seller not found");
    }

    return handleResponse(res, 200, "Seller application rejected", seller);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const bounceBackSellerApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, adminRemark, adminTerms } = req.body;
    const seller = await bounceBackSellerApplicationById({
      sellerId: id,
      reviewedBy: req.user.id,
      reason,
      adminRemark,
      adminTerms,
    });

    if (!seller) {
      return handleResponse(res, 404, "Seller not found");
    }

    return handleResponse(res, 200, "Seller application bounced back", seller);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const reuploadSellerDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const documentKey = req.body.documentKey;
    
    if (!documentKey) {
      return handleResponse(res, 400, "Document key is required");
    }

    if (!req.file) {
      return handleResponse(res, 400, "No file provided for reupload");
    }

    const seller = await Seller.findById(id);
    if (!seller) {
      return handleResponse(res, 404, "Seller not found");
    }

    let url = await saveRawFile(req.file.buffer, "docs", req.file.originalname);
    const reqDomain = `${req.protocol}://${req.get("host")}`;
    const envDomain = process.env.API_DOMAIN || "http://localhost:7000";
    
    if (url.startsWith("/")) {
        url = `${reqDomain}${url}`;
    }
    
    if (url.includes("localhost") || url.includes("host:7000") || url.startsWith("http://10.0.2.2")) {
        if (url.startsWith(envDomain)) {
            url = url.replace(envDomain, reqDomain);
        } else if (url.startsWith("host:7000")) {
            url = url.replace("host:7000", reqDomain);
        } else if (url.startsWith("http://host:7000")) {
            url = url.replace("http://host:7000", reqDomain);
        }
    }

    if (!seller.documents) seller.documents = {};
    seller.documents[documentKey] = url;
    
    // Use set() for Map type
    if (!seller.documentStatuses) seller.documentStatuses = new Map();
    seller.documentStatuses.set(documentKey, "reuploaded");

    await seller.save();

    return handleResponse(res, 200, "Document reuploaded successfully", { documentKey, url, status: "reuploaded" });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const approveSellerDocument = async (req, res) => {
  try {
    const { id, documentKey } = req.params;
    const { status } = req.body;

    const seller = await Seller.findById(id);
    if (!seller) {
      return handleResponse(res, 404, "Seller not found");
    }

    if (!seller.documentStatuses) seller.documentStatuses = new Map();
    seller.documentStatuses.set(documentKey, status || "approved");

    await seller.save();

    return handleResponse(res, 200, "Document status updated", { documentKey, status: seller.documentStatuses.get(documentKey) });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};
