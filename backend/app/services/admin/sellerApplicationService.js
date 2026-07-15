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
  let baseStatusQuery = { isVerified: { $ne: true } };

  if (normalizedStatus === "pending") {
    baseStatusQuery = {
      isVerified: { $ne: true },
      $or: [
        { applicationStatus: "pending" },
        { applicationStatus: { $exists: false } },
        { applicationStatus: null },
      ],
    };
  } else if (normalizedStatus !== "all") {
    baseStatusQuery = {
      isVerified: { $ne: true },
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
    applicationStatus: "approved",
    reviewedAt: new Date(),
    reviewedBy,
    rejectionReason: null,
  };

  if (permissions) {
    if (typeof permissions.retailEnabled === 'boolean') {
      updateData.retailEnabled = permissions.retailEnabled;
    }
    if (typeof permissions.planMyEventEnabled === 'boolean') {
      updateData.planMyEventEnabled = permissions.planMyEventEnabled;
    }
    if (typeof permissions.productsEnabled === 'boolean') {
      updateData.productsEnabled = permissions.productsEnabled;
    }
    if (typeof permissions.stockEnabled === 'boolean') {
      updateData.stockEnabled = permissions.stockEnabled;
    }
    if (typeof permissions.ordersEnabled === 'boolean') {
      updateData.ordersEnabled = permissions.ordersEnabled;
    }
    if (typeof permissions.walletEnabled === 'boolean') {
      updateData.walletEnabled = permissions.walletEnabled;
    }
    if (typeof permissions.analyticsEnabled === 'boolean') {
      updateData.analyticsEnabled = permissions.analyticsEnabled;
    }
    if (typeof permissions.wholesaleEnabled === 'boolean') {
      updateData.wholesaleEnabled = permissions.wholesaleEnabled;
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
}) {
  const seller = await Seller.findByIdAndUpdate(
    sellerId,
    {
      $set: {
        isVerified: false,
        isActive: false,
        applicationStatus: "rejected",
        reviewedAt: new Date(),
        reviewedBy,
        rejectionReason: reason || "",
      },
    },
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
}) {
  const seller = await Seller.findByIdAndUpdate(
    sellerId,
    {
      $set: {
        isVerified: false,
        applicationStatus: "bounced_back",
        reviewedAt: new Date(),
        reviewedBy,
      },
    },
    { new: true },
  );

  if (!seller) {
    return null;
  }

  return formatSellerApplication(seller);
}
