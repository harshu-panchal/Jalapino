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
      description,
      sellerStatus, 
      commissionRate, 
      bankDetails,
      hasProductAccess,
      retailEnabled,
      planMyEventEnabled,
      eventDetailsEnabled,
      categoriesEnabled,
      bookingSlotsEnabled,
      productsEnabled,
      stockEnabled,
      ordersEnabled,
      walletEnabled,
      analyticsEnabled,
      wholesaleEnabled,
      allowedRetailCategories,
      allowedWholesaleCategories,
      allowedEventCategories,
      serviceCategories,
      availableColors
    } = req.body;
    const adminRemark = req.body.adminRemark;
    const adminTerms = req.body.adminTerms;
    const advancePaymentPercentage = req.body.advancePaymentPercentage;
    const allowCustomProductEntry = req.body.allowCustomProductEntry;
    const liveKitchenEnabled = req.body.liveKitchenEnabled;
    const liveAddToCartEnabled = req.body.liveAddToCartEnabled;
    const liveServicesEnabled = req.body.liveServicesEnabled;
    const customizationEngineEnabled = req.body.customizationEngineEnabled;
    const quoteReferencePhotoUpload = req.body.quoteReferencePhotoUpload;
    const quoteThemeSelection = req.body.quoteThemeSelection;
    const quoteColorCombination = req.body.quoteColorCombination;
    const quoteBudgetSelection = req.body.quoteBudgetSelection;
    const quoteCustomerNotes = req.body.quoteCustomerNotes;
    const quoteSellerQuotation = req.body.quoteSellerQuotation;
    const quoteQuoteRevision = req.body.quoteQuoteRevision;
    const quoteCustomerApproval = req.body.quoteCustomerApproval;
    const quoteAdvancePayment = req.body.quoteAdvancePayment;
    const quoteFinalPayment = req.body.quoteFinalPayment;
    const acceptsCOD = req.body.acceptsCOD;
    const acceptsRazorpay = req.body.acceptsRazorpay;
    const customerImageReviewEnabled = req.body.customerImageReviewEnabled;
    const advanceBookingEnabled = req.body.advanceBookingEnabled;
    const reviewCategoriesEnabled = req.body.reviewCategoriesEnabled;
    const addonDecorationEnabled = req.body.addonDecorationEnabled;
    const addonDecorationPrice = req.body.addonDecorationPrice;
    const addonBridalEnabled = req.body.addonBridalEnabled;
    const addonBridalPrice = req.body.addonBridalPrice;
    const addonCateringEnabled = req.body.addonCateringEnabled;
    const addonCateringPrice = req.body.addonCateringPrice;
    const physicalPaymentEnabled = req.body.physicalPaymentEnabled;
    const paymentQrCode = req.body.paymentQrCode;
    const ticketSystemEnabled = req.body.ticketSystemEnabled;
    const videoUploadEnabled = req.body.videoUploadEnabled;

    const Seller = await import("../../models/seller.js").then((m) => m.default);
    
    const updateData = {};
    if (shopName) updateData.shopName = shopName;
    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;
    if (address) updateData.address = address;
    if (description !== undefined) updateData.description = description;
    if (sellerStatus) updateData.sellerStatus = sellerStatus;
    if (commissionRate !== undefined) updateData.commissionRate = Number(commissionRate);
    if (bankDetails) updateData.bankDetails = bankDetails;
    if (hasProductAccess !== undefined) updateData.hasProductAccess = hasProductAccess;
    if (retailEnabled !== undefined) updateData.retailEnabled = retailEnabled;
    if (planMyEventEnabled !== undefined) updateData.planMyEventEnabled = planMyEventEnabled;
    if (eventDetailsEnabled !== undefined) updateData.eventDetailsEnabled = eventDetailsEnabled;
    if (categoriesEnabled !== undefined) updateData.categoriesEnabled = categoriesEnabled;
    if (bookingSlotsEnabled !== undefined) updateData.bookingSlotsEnabled = bookingSlotsEnabled;
    if (productsEnabled !== undefined) updateData.productsEnabled = productsEnabled;
    if (stockEnabled !== undefined) updateData.stockEnabled = stockEnabled;
    if (ordersEnabled !== undefined) updateData.ordersEnabled = ordersEnabled;
    if (walletEnabled !== undefined) updateData.walletEnabled = walletEnabled;
    if (analyticsEnabled !== undefined) updateData.analyticsEnabled = analyticsEnabled;
    if (wholesaleEnabled !== undefined) updateData.wholesaleEnabled = wholesaleEnabled;
    if (allowedRetailCategories !== undefined) updateData.allowedRetailCategories = allowedRetailCategories;
    if (allowedWholesaleCategories !== undefined) updateData.allowedWholesaleCategories = allowedWholesaleCategories;
    if (allowedEventCategories !== undefined) updateData.allowedEventCategories = allowedEventCategories;
    if (serviceCategories !== undefined) updateData.serviceCategories = serviceCategories;
    if (availableColors !== undefined) updateData.availableColors = availableColors;
    if (adminRemark !== undefined) updateData.adminRemark = adminRemark;
    if (adminTerms !== undefined) updateData.adminTerms = adminTerms;
    if (videoUploadEnabled !== undefined) updateData.videoUploadEnabled = videoUploadEnabled;
    if (advancePaymentPercentage !== undefined) updateData.advancePaymentPercentage = Number(advancePaymentPercentage);
    if (allowCustomProductEntry !== undefined) updateData.allowCustomProductEntry = allowCustomProductEntry;
    if (liveKitchenEnabled !== undefined) updateData.liveKitchenEnabled = liveKitchenEnabled;
    if (liveAddToCartEnabled !== undefined) updateData.liveAddToCartEnabled = liveAddToCartEnabled;
    if (liveServicesEnabled !== undefined) updateData.liveServicesEnabled = liveServicesEnabled;
    if (customizationEngineEnabled !== undefined) updateData.customizationEngineEnabled = customizationEngineEnabled;
    if (quoteReferencePhotoUpload !== undefined) updateData.quoteReferencePhotoUpload = quoteReferencePhotoUpload;
    if (quoteThemeSelection !== undefined) updateData.quoteThemeSelection = quoteThemeSelection;
    if (quoteColorCombination !== undefined) updateData.quoteColorCombination = quoteColorCombination;
    if (quoteBudgetSelection !== undefined) updateData.quoteBudgetSelection = quoteBudgetSelection;
    if (quoteCustomerNotes !== undefined) updateData.quoteCustomerNotes = quoteCustomerNotes;
    if (quoteSellerQuotation !== undefined) updateData.quoteSellerQuotation = quoteSellerQuotation;
    if (quoteQuoteRevision !== undefined) updateData.quoteQuoteRevision = quoteQuoteRevision;
    if (quoteCustomerApproval !== undefined) updateData.quoteCustomerApproval = quoteCustomerApproval;
    if (quoteAdvancePayment !== undefined) updateData.quoteAdvancePayment = quoteAdvancePayment;
    if (quoteFinalPayment !== undefined) updateData.quoteFinalPayment = quoteFinalPayment;
    if (acceptsCOD !== undefined) updateData.acceptsCOD = acceptsCOD;
    if (acceptsRazorpay !== undefined) updateData.acceptsRazorpay = acceptsRazorpay;
    if (customerImageReviewEnabled !== undefined) updateData.customerImageReviewEnabled = customerImageReviewEnabled;
    if (advanceBookingEnabled !== undefined) updateData.advanceBookingEnabled = advanceBookingEnabled;
    if (reviewCategoriesEnabled !== undefined) updateData.reviewCategoriesEnabled = reviewCategoriesEnabled;
    if (addonDecorationEnabled !== undefined) updateData.addonDecorationEnabled = addonDecorationEnabled;
    if (addonDecorationPrice !== undefined) updateData.addonDecorationPrice = Number(addonDecorationPrice);
    if (addonBridalEnabled !== undefined) updateData.addonBridalEnabled = addonBridalEnabled;
    if (addonBridalPrice !== undefined) updateData.addonBridalPrice = Number(addonBridalPrice);
    if (addonCateringEnabled !== undefined) updateData.addonCateringEnabled = addonCateringEnabled;
    if (addonCateringPrice !== undefined) updateData.addonCateringPrice = Number(addonCateringPrice);
    if (physicalPaymentEnabled !== undefined) updateData.physicalPaymentEnabled = physicalPaymentEnabled;
    if (paymentQrCode !== undefined) updateData.paymentQrCode = paymentQrCode;
    if (ticketSystemEnabled !== undefined) updateData.ticketSystemEnabled = ticketSystemEnabled;

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
