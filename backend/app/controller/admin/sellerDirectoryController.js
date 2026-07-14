import handleResponse from "../../utils/helper.js";
import getPagination from "../../utils/pagination.js";
import {
  getActiveSellersData,
  getSellerLocationsData,
  getSellerOptions,
} from "../../services/admin/sellerDirectoryService.js";

export const getSellerLocations = async (req, res) => {
  try {
    const {
      q = "",
      category = "all",
      city = "all",
      lifecycle = "all",
      mapLimit: rawMapLimit = "500",
      sort = "orders_desc",
    } = req.query;

    const { page, limit, skip } = getPagination(req, {
      defaultLimit: 25,
      maxLimit: 100,
    });

    const data = await getSellerLocationsData({
      q,
      category,
      city,
      lifecycle,
      mapLimit: rawMapLimit,
      sort,
      page,
      limit,
      skip,
    });

    return handleResponse(res, 200, "Seller locations fetched successfully", data);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const getActiveSellers = async (req, res) => {
  try {
    const { q = "", category = "all", sort = "recent" } = req.query;
    const { page, limit, skip } = getPagination(req, {
      defaultLimit: 20,
      maxLimit: 100,
    });

    const data = await getActiveSellersData({
      q,
      category,
      sort,
      page,
      limit,
      skip,
    });

    return handleResponse(res, 200, "Active sellers fetched successfully", data);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const getSellers = async (req, res) => {
  try {
    const sellers = await getSellerOptions();
    return handleResponse(res, 200, "Sellers fetched", sellers);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const getSellerById = async (req, res) => {
  try {
    const { id } = req.params;
    const Seller = await import("../../models/seller.js").then((m) => m.default);
    const Wallet = await import("../../models/wallet.js").then((m) => m.default);
    const SellerMetrics = await import("../../models/sellerMetrics.js").then((m) => m.default);
    const EventBooking = await import("../../models/event/EventBooking.js").then((m) => m.default);
    
    const seller = await Seller.findById(id).lean();
    if (!seller) throw new Error("Seller not found");

    // Fetch Wallet Balance
    const wallet = await Wallet.findOne({ ownerId: id, ownerType: "SELLER" }).lean();
    const walletBalance = wallet ? (wallet.availableBalance + (wallet.pendingBalance || 0)) : 0;

    let totalOrders = 0;
    let totalRevenue = 0;

    if (seller.isEventSeller) {
      // Fetch Event Booking stats
      const bookings = await EventBooking.find({ "services.seller": id }).lean();
      totalOrders = bookings.length;
      totalRevenue = bookings.reduce((sum, booking) => sum + (booking.totalAmount || 0), 0);
    } else {
      // Fetch Normal Order stats
      const metrics = await SellerMetrics.aggregate([
        { $match: { sellerId: seller._id } },
        { $group: { _id: null, totalOrders: { $sum: "$orderCount" }, totalRevenue: { $sum: "$revenue" } } }
      ]);
      if (metrics && metrics.length > 0) {
        totalOrders = metrics[0].totalOrders;
        totalRevenue = metrics[0].totalRevenue;
      }
    }

    // Rating (Fallback to 0 if Review collection not setup for sellers yet)
    let rating = 0;
    try {
      const Review = await import("../../models/review.js").then((m) => m.default);
      const reviews = await Review.aggregate([
        { $match: { sellerId: seller._id } },
        { $group: { _id: null, avgRating: { $avg: "$rating" } } }
      ]);
      if (reviews && reviews.length > 0) {
        rating = Number(reviews[0].avgRating.toFixed(1));
      }
    } catch (e) {
      // Ignore if review model doesn't support sellerId yet
    }

    const payload = {
      ...seller,
      stats: {
        walletBalance,
        totalOrders,
        totalRevenue,
        rating
      }
    };

    return handleResponse(res, 200, "Seller fetched", payload);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const updateSellerType = async (req, res) => {
  try {
    const { id } = req.params;
    const { isEventSeller, serviceCategories, maxGuestCapacity } = req.body;
    const Seller = await import("../../models/seller.js").then((m) => m.default);
    
    const seller = await Seller.findByIdAndUpdate(
      id,
      { $set: { isEventSeller, serviceCategories, maxGuestCapacity } },
      { new: true }
    );
    
    if (!seller) throw new Error("Seller not found");
    return handleResponse(res, 200, "Seller type updated", seller);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const updateSellerDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      shopName, 
      name, 
      phone, 
      address, 
      sellerStatus, 
      commissionRate, 
      bankDetails,
      hasProductAccess,
      retailEnabled,
      planMyEventEnabled,
      productsEnabled,
      stockEnabled,
      ordersEnabled,
      walletEnabled,
      analyticsEnabled,
      wholesaleEnabled
    } = req.body;
    const adminRemark = req.body.adminRemark;

    const Seller = await import("../../models/seller.js").then((m) => m.default);
    
    const updateData = {};
    if (shopName) updateData.shopName = shopName;
    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;
    if (address) updateData.address = address;
    if (sellerStatus) updateData.sellerStatus = sellerStatus;
    if (commissionRate !== undefined) updateData.commissionRate = Number(commissionRate);
    if (bankDetails) updateData.bankDetails = bankDetails;
    if (hasProductAccess !== undefined) updateData.hasProductAccess = hasProductAccess;
    if (retailEnabled !== undefined) updateData.retailEnabled = retailEnabled;
    if (planMyEventEnabled !== undefined) updateData.planMyEventEnabled = planMyEventEnabled;
    if (productsEnabled !== undefined) updateData.productsEnabled = productsEnabled;
    if (stockEnabled !== undefined) updateData.stockEnabled = stockEnabled;
    if (ordersEnabled !== undefined) updateData.ordersEnabled = ordersEnabled;
    if (walletEnabled !== undefined) updateData.walletEnabled = walletEnabled;
    if (analyticsEnabled !== undefined) updateData.analyticsEnabled = analyticsEnabled;
    if (wholesaleEnabled !== undefined) updateData.wholesaleEnabled = wholesaleEnabled;
    if (adminRemark !== undefined) updateData.adminRemark = adminRemark;

    // Find and update
    const seller = await Seller.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    );

    if (!seller) throw new Error("Seller not found");
    
    return handleResponse(res, 200, "Seller details updated successfully", seller);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};
