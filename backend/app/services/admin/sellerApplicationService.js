import Seller from "../../models/seller.js";
import {
  escapeRegExp,
  formatSellerApplication,
  formatSellerDocuments,
} from "./shared/sellerAdminUtils.js";

export async function getPendingSellerApplications({
  q = "",
  status = "pending",
  page,
  limit,
  skip,
}) {
  const normalizedStatus = String(status || "pending").trim().toLowerCase();
  let baseStatusQuery = {};

  if (normalizedStatus === "pending") {
    baseStatusQuery = {
      isVerified: { $ne: true },
      $or: [
        { applicationStatus: "pending" },
        { applicationStatus: { $exists: false } },
        { applicationStatus: null },
      ],
    };
  } else if (normalizedStatus === "all") {
    // pending + bounced_back dono dikhao (approved/rejected exclude)
    baseStatusQuery = {
      $or: [
        { applicationStatus: "pending", isVerified: { $ne: true } },
        { applicationStatus: { $exists: false }, isVerified: { $ne: true } },
        { applicationStatus: "bounced_back" },
      ],
    };
  } else {
    baseStatusQuery = {
      applicationStatus: normalizedStatus,
    };
  }

  const conditions = [baseStatusQuery];
  const search = String(q || "").trim();
  if (search) {
    const regex = new RegExp(escapeRegExp(search), "i");
    conditions.push({
      $or: [
        { name: regex },
        { shopName: regex },
        { email: regex },
        { phone: regex },
        { address: regex },
      ],
    });
  }

  const query = conditions.length > 1 ? { $and: conditions } : conditions[0];

  const [sellers, total, allPendingForStats] = await Promise.all([
    Seller.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Seller.countDocuments(query),
    Seller.find({
      isVerified: { $ne: true },
      $or: [
        { applicationStatus: "pending" },
        { applicationStatus: { $exists: false } },
      ],
    })
      .select("address documents createdAt")
      .lean(),
  ]);

  const items = sellers.map(formatSellerApplication);
  const totalApplications = allPendingForStats.length;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const receivedToday = allPendingForStats.filter(
    (seller) => seller.createdAt && new Date(seller.createdAt) >= todayStart,
  ).length;

  const missingInfo = allPendingForStats.filter((seller) => {
    const docs = formatSellerDocuments(seller.documents);
    return !seller.address || docs.length < 3;
  }).length;

  return {
    items,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
    stats: {
      totalApplications,
      receivedToday,
      missingInfo,
      avgReviewTimeHours: 24,
    },
  };
}

export async function approveSellerApplicationById({ sellerId, reviewedBy, permissions }) {
  const updateData = {
    isVerified: true,
    isActive: true,
    sellerStatus: "active",                     // active sellers list mein dikhao
    sellerVerificationStatus: "verified",       // event seller search query match kare
    applicationStatus: "approved",
    isEventSeller: true,                        // Plan My Event search results ke liye
    planMyEventEnabled: true,
    reviewedAt: new Date(),
    reviewedBy,
    rejectionReason: null,
  };

  if (permissions) {
    for (const [key, value] of Object.entries(permissions)) {
      if (typeof value === 'boolean') {
        updateData[key] = value;
      } else if (Array.isArray(value) || typeof value === 'number' || typeof value === 'string') {
        // Also save arrays like allowedRetailCategories and numbers/strings like advancePaymentPercentage
        updateData[key] = value;
      }
    }
  }

  const seller = await Seller.findByIdAndUpdate(
    sellerId,
    { $set: updateData },
    { new: true },
  );

  if (!seller) {
    return null;
  }

  return formatSellerApplication(seller);
}

export async function rejectSellerApplicationById({
  sellerId,
  reviewedBy,
  reason,
  adminRemark,
  adminTerms,
}) {
  const updatePayload = {
    isVerified: false,
    isActive: false,
    applicationStatus: "rejected",
    reviewedAt: new Date(),
    reviewedBy,
    rejectionReason: reason || "",
  };
  if (adminRemark !== undefined) updatePayload.adminRemark = adminRemark;
  if (adminTerms !== undefined) updatePayload.adminTerms = adminTerms;

  const seller = await Seller.findByIdAndUpdate(
    sellerId,
    { $set: updatePayload },
    { new: true },
  );

  if (!seller) {
    return null;
  }

  return formatSellerApplication(seller);
}

export async function bounceBackSellerApplicationById({
  sellerId,
  reviewedBy,
  reason,
  adminRemark,
  adminTerms,
}) {
  const updatePayload = {
    isVerified: false,
    isActive: false,
    sellerStatus: "inactive",           // bounce back pe active list se remove karo
    sellerVerificationStatus: "pending",
    applicationStatus: "bounced_back",
    reviewedAt: new Date(),
    reviewedBy,
  };

  if (reason) {
    updatePayload.rejectionReason = reason;
  }
  if (adminRemark !== undefined) updatePayload.adminRemark = adminRemark;
  if (adminTerms !== undefined) updatePayload.adminTerms = adminTerms;

  const seller = await Seller.findByIdAndUpdate(
    sellerId,
    { $set: updatePayload },
    { new: true },
  );

  if (!seller) {
    return null;
  }

  return formatSellerApplication(seller);
}
