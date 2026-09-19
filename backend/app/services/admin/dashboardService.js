import User from "../../models/customer.js";
import Seller from "../../models/seller.js";
import Delivery from "../../models/delivery.js";
import Order from "../../models/order.js";
import Product from "../../models/product.js";

const DASHBOARD_CATEGORY_COLORS = ["#4f46e5", "#10b981", "#f59e0b", "#ef4444"];

export async function getAdminDashboardStats(module = "all") {
  const sellerQuery = {};
  const orderQuery = {};
  const activeSellerQuery = { isVerified: true };

  if (module === "retail") {
    sellerQuery.retailEnabled = true;
    activeSellerQuery.retailEnabled = true;
    orderQuery.moduleType = "retail";
  } else if (module === "wholesale") {
    sellerQuery.wholesaleEnabled = true;
    activeSellerQuery.wholesaleEnabled = true;
    orderQuery.moduleType = "wholesale";
  } else if (module === "plan_my_event") {
    sellerQuery.$or = [{ planMyEventEnabled: true }, { isEventSeller: true }];
    activeSellerQuery.$or = [{ planMyEventEnabled: true }, { isEventSeller: true }];
    orderQuery.moduleType = "plan_my_event";
  }

  const [totalCustomers, totalSellers, totalRiders, totalOrders] =
    await Promise.all([
      User.countDocuments({ role: "user" }),
      Seller.countDocuments(sellerQuery),
      Delivery.countDocuments(),
      Order.countDocuments(orderQuery),
    ]);

  const totalUsers = totalCustomers;
  const activeSellers = await Seller.countDocuments(activeSellerQuery);

  const revenueData = await Order.aggregate([
    { $match: { status: "delivered", ...orderQuery } },
    { $group: { _id: null, total: { $sum: "$pricing.total" } } },
  ]);
  const totalRevenue = revenueData[0]?.total || 0;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const historyAggregation = await Order.aggregate([
    { $match: { createdAt: { $gte: thirtyDaysAgo }, status: "delivered", ...orderQuery } },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
        },
        revenue: { $sum: "$pricing.total" },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Create a map of existing revenue data
  const revenueMap = new Map(historyAggregation.map(item => [item._id, item.revenue]));
  
  // Fill in the last 30 days with 0 where no data exists
  const revenueHistory = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    revenueHistory.push({
      name: d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
      revenue: revenueMap.get(dateStr) || 0,
      fullDate: dateStr
    });
  }

  const recentOrders = await Order.find(orderQuery)
    .sort({ createdAt: -1 })
    .limit(5)
    .populate("customer", "name");

  const categoryData = await Product.aggregate([
    { $group: { _id: "$headerId", count: { $sum: 1 } } },
    {
      $lookup: {
        from: "categories",
        localField: "_id",
        foreignField: "_id",
        as: "category",
      },
    },
    { $unwind: "$category" },
    { $project: { name: "$category.name", value: "$count" } },
    { $limit: 4 },
  ]);

  const topProducts = await Order.aggregate([
    { $match: orderQuery },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.product",
        sales: { $sum: "$items.quantity" },
        revenue: {
          $sum: { $multiply: ["$items.quantity", "$items.price"] },
        },
      },
    },
    { $sort: { sales: -1 } },
    { $limit: 5 },
    {
      $lookup: {
        from: "products",
        localField: "_id",
        foreignField: "_id",
        as: "product",
      },
    },
    { $unwind: "$product" },
    {
      $project: {
        name: "$product.name",
        sales: 1,
        rev: "$revenue",
        image: "$product.mainImage",
      },
    },
  ]);

  return {
    overview: {
      totalUsers,
      activeSellers,
      totalOrders,
      totalRevenue,
    },
    revenueHistory,
    recentOrders: recentOrders.map((order) => ({
      id: order.orderId,
      customer: order.customer?.name || "Guest",
      statusText: order.status,
      status:
        order.status === "delivered"
          ? "success"
          : order.status === "cancelled"
            ? "error"
            : "warning",
      amount: `\u20B9${order.pricing.total}`,
      time: "Recently",
    })),
    categoryData: categoryData.map((category, index) => ({
      ...category,
      color: DASHBOARD_CATEGORY_COLORS[index % DASHBOARD_CATEGORY_COLORS.length],
    })),
    topProducts: topProducts.map((product) => ({
      name: product.name,
      sales: product.sales,
      rev: `\u20B9${product.rev.toFixed(2)}`,
      trend: "+5%",
      cat: "Product",
      image: product.image,
      icon: "\u{1F4E6}", // Fallback package icon
      color: "bg-blue-50 text-blue-600",
    })),
  };
}
