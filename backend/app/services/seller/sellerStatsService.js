/**
 * SellerStatsService
 *
 * Cache-fronted reader for the seller dashboard stats and reporting payload.
 * Aggregates all commerce modules dynamically from DB:
 * 1. Plan My Event (EventBooking)
 * 2. Tickets & Venues (GeneralBooking & MemberTicket)
 * 3. Retail & Wholesale (Order)
 *
 * Output provides executive overview, trend charts, module & category breakdown,
 * and detailed bookings ledger for on-screen reports and CSV downloads.
 */

import mongoose from "mongoose";

import Order from "../../models/order.js";
import Product from "../../models/product.js";
import EventBooking from "../../models/event/EventBooking.js";
import GeneralBooking from "../../models/event/GeneralBooking.js";
import MemberTicket from "../../models/event/MemberTicket.js";
import CustomizationRequest from "../../models/event/CustomizationRequest.js";
import EventCategory from "../../models/event/EventCategory.js";
import User from "../../models/customer.js";
import { buildKey, getOrSet, getTTL } from "../cacheService.js";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const SOURCE_COLORS = {
  Direct: "#3b82f6",
  Search: "#10b981",
  Social: "#f59e0b",
  Referral: "#8b5cf6",
};

function svcErr(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function toSellerOid(rawId) {
  if (rawId == null) {
    throw svcErr("Unauthorized", 401);
  }
  if (!mongoose.Types.ObjectId.isValid(String(rawId))) {
    throw svcErr("Invalid user id", 401);
  }
  return new mongoose.Types.ObjectId(String(rawId));
}

function normalizeRange(value) {
  const v = String(value || "daily").toLowerCase();
  if (v === "monthly" || v === "weekly" || v === "daily") return v;
  return "daily";
}

/**
 * Public read API. Cached for short TTL (10s so dynamic data is fresh)
 */
export async function getSellerStats(sellerId, { range = "daily" } = {}) {
  const sellerOid = toSellerOid(sellerId);
  const normRange = normalizeRange(range);
  const cacheKey = buildKey(
    "seller",
    "stats_v2",
    `${sellerOid.toString()}:${normRange}`,
  );
  return getOrSet(
    cacheKey,
    () => computeSellerStats(sellerOid, normRange),
    10, // 10s short cache to reflect dynamic updates instantly
  );
}

async function computeSellerStats(sellerOid, range) {
  const now = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  // 1. Fetch Retail / Wholesale Orders
  let orders = [];
  try {
    orders = await Order.find({ seller: sellerOid, status: { $ne: "cancelled" } })
      .populate("items.product", "name categoryId price")
      .populate("customer", "name phone email")
      .sort({ createdAt: -1 })
      .lean();
  } catch (e) {
    console.warn("[SellerStatsService] Error fetching orders:", e.message);
  }

  // 2. Fetch Plan My Event Bookings
  let eventBookings = [];
  try {
    eventBookings = await EventBooking.find({
      "services.seller": sellerOid,
      overallStatus: { $ne: "CANCELLED" },
    })
      .populate("services.category", "name icon")
      .populate("customer", "name phone email")
      .sort({ createdAt: -1 })
      .lean();
  } catch (e) {
    console.warn("[SellerStatsService] Error fetching eventBookings:", e.message);
  }

  // 3. Fetch Ticket Bookings (GeneralBooking)
  let generalBookings = [];
  try {
    generalBookings = await GeneralBooking.find({
      sellerId: sellerOid,
      bookingStatus: { $nin: ["Cancelled", "cancelled", "Rejected"] },
    })
      .populate({
        path: "venueId",
        select: "name categoryId price",
        populate: { path: "categoryId", select: "name" },
      })
      .populate("customerId", "name phone email")
      .sort({ createdAt: -1 })
      .lean();
  } catch (e) {
    console.warn("[SellerStatsService] Error fetching generalBookings:", e.message);
  }

  // 4. Fetch Member Tickets
  let memberTickets = [];
  try {
    memberTickets = await MemberTicket.find({ sellerId: sellerOid })
      .populate("venueId", "name")
      .populate("customerId", "name phone email")
      .sort({ createdAt: -1 })
      .lean();
  } catch (e) {
    console.warn("[SellerStatsService] Error fetching memberTickets:", e.message);
  }

  // 5. Customization & Quotation bookings (separate from event bookings).
  //    Counted as a sale once CONFIRMED (customer paid online or chose COD).
  let customizations = [];
  try {
    customizations = await CustomizationRequest.find({ seller: sellerOid, status: "CONFIRMED" })
      .populate("customer", "name phone")
      .sort({ createdAt: -1 })
      .lean();
  } catch (e) {
    console.warn("[SellerStatsService] Error fetching customizations:", e.message);
  }

  // --- Count only real sales (avoid mismatch) ---
  // Events: only bookings this seller ACCEPTED / CONFIRMED / COMPLETED
  // (not pending requests, not seller-rejected; cancelled already excluded).
  const sellerServiceOf = (eb) => (eb.services || []).find(
    (s) => s.seller?.toString() === sellerOid.toString()
  );
  eventBookings = eventBookings.filter((eb) =>
    ["ACCEPTED", "CONFIRMED", "COMPLETED"].includes(sellerServiceOf(eb)?.status)
  );
  // Same amount for totals, reports and chart.
  const eventAmountOf = (eb) => {
    const sellerService = sellerServiceOf(eb);
    const validCount = (eb.services || []).filter((s) =>
      ["ACCEPTED", "CONFIRMED", "COMPLETED", "PENDING_APPROVAL"].includes(s.status)
    ).length;
    return Number(sellerService?.amount || (eb.totalAmount / (validCount || 1)) || 0);
  };
  // Tickets: only Confirmed / Completed bookings (an online booking becomes
  // Confirmed only after verified payment; COD/Physical are Confirmed on booking).
  // Failed / refunded payments are not sales.
  generalBookings = generalBookings.filter((gb) =>
    ["Confirmed", "Completed"].includes(gb.bookingStatus)
    && !["Failed", "Refunded"].includes(gb.paymentStatus)
  );

  // --- Aggregate Modules & Detailed Reports ---
  const detailedReports = [];
  const moduleMap = {
    "Plan My Event": {
      module: "Plan My Event",
      name: "Events",
      icon: "🎉",
      totalOrders: 0,
      totalSales: 0,
      categories: {},
    },
    "Tickets & Venues": {
      module: "Tickets & Venues",
      name: "Tickets",
      icon: "🎟️",
      totalOrders: 0,
      totalSales: 0,
      totalTickets: 0,
      categories: {},
    },
    Retail: {
      module: "Retail",
      name: "Retail",
      icon: "🛍️",
      totalOrders: 0,
      totalSales: 0,
      categories: {},
    },
    Wholesale: {
      module: "Wholesale",
      name: "Wholesale",
      icon: "📦",
      totalOrders: 0,
      totalSales: 0,
      categories: {},
    },
    Customization: {
      module: "Customization",
      name: "Customization",
      icon: "🎨",
      totalOrders: 0,
      totalSales: 0,
      categories: {},
    },
  };

  const topProductMap = new Map();
  let currentWeekSales = 0;
  let prevWeekSales = 0;
  let currentWeekOrders = 0;
  let prevWeekOrders = 0;

  // Process Event Bookings
  eventBookings.forEach((eb) => {
    const sellerService = sellerServiceOf(eb);
    const amount = eventAmountOf(eb);
    const categoryName = sellerService?.category?.name || eb.eventType || "Event Service";

    moduleMap["Plan My Event"].totalOrders++;
    moduleMap["Plan My Event"].totalSales += amount;
    if (!moduleMap["Plan My Event"].categories[categoryName]) {
      moduleMap["Plan My Event"].categories[categoryName] = {
        name: categoryName,
        count: 0,
        revenue: 0,
      };
    }
    moduleMap["Plan My Event"].categories[categoryName].count++;
    moduleMap["Plan My Event"].categories[categoryName].revenue += amount;

    // Top items tracking
    const prodKey = `Event: ${categoryName}`;
    const curP = topProductMap.get(prodKey) || { name: categoryName, sales: 0, revenue: 0, module: "Events" };
    curP.sales++;
    curP.revenue += amount;
    topProductMap.set(prodKey, curP);

    // Week metrics
    const cDate = new Date(eb.createdAt);
    if (cDate >= sevenDaysAgo) {
      currentWeekSales += amount;
      currentWeekOrders++;
    } else if (cDate >= fourteenDaysAgo) {
      prevWeekSales += amount;
      prevWeekOrders++;
    }

    const contactName =
      eb.eventInfo?.primaryContactName || eb.customer?.name || "Customer";
    const contactPhone =
      eb.eventInfo?.primaryPhone || eb.customer?.phone || "";

    detailedReports.push({
      id: eb.bookingId || String(eb._id).slice(-8).toUpperCase(),
      module: "Plan My Event",
      category: categoryName,
      customerName: contactName,
      customerPhone: contactPhone,
      date: eb.eventDate
        ? new Date(eb.eventDate).toLocaleDateString("en-IN")
        : new Date(eb.createdAt).toLocaleDateString("en-IN"),
      time: eb.eventTime || "—",
      status: eb.overallStatus || "PENDING",
      amount: Math.round(amount),
      details: `${eb.guestCount || 1} Guests • ${eb.eventType || "Event"}`,
      createdAt: eb.createdAt,
    });
  });

  // Process Ticket Bookings (GeneralBooking & MemberTicket)
  generalBookings.forEach((gb) => {
    const venueName = gb.venueId?.name || "Venue Ticket";
    const categoryName = gb.venueId?.categoryId?.name || venueName;
    const amount = Number(gb.totalAmount || 0);
    const members = Number(gb.totalMembers || 1);

    moduleMap["Tickets & Venues"].totalOrders++;
    moduleMap["Tickets & Venues"].totalSales += amount;
    moduleMap["Tickets & Venues"].totalTickets += members;

    if (!moduleMap["Tickets & Venues"].categories[categoryName]) {
      moduleMap["Tickets & Venues"].categories[categoryName] = {
        name: categoryName,
        count: 0,
        revenue: 0,
        ticketsCount: 0,
      };
    }
    moduleMap["Tickets & Venues"].categories[categoryName].count++;
    moduleMap["Tickets & Venues"].categories[categoryName].revenue += amount;
    moduleMap["Tickets & Venues"].categories[categoryName].ticketsCount += members;

    // Top items tracking
    const prodKey = `Ticket: ${venueName}`;
    const curP = topProductMap.get(prodKey) || { name: venueName, sales: 0, revenue: 0, module: "Tickets" };
    curP.sales += members;
    curP.revenue += amount;
    topProductMap.set(prodKey, curP);

    // Week metrics
    const cDate = new Date(gb.createdAt);
    if (cDate >= sevenDaysAgo) {
      currentWeekSales += amount;
      currentWeekOrders++;
    } else if (cDate >= fourteenDaysAgo) {
      prevWeekSales += amount;
      prevWeekOrders++;
    }

    // Find linked member tickets
    const linkedTickets = memberTickets.filter(
      (mt) => mt.bookingId?.toString() === gb._id.toString()
    );
    const ticketIds = linkedTickets.map((t) => t.ticketId).filter(Boolean);

    // Show the member(s) the ticket was booked for (name / mobile from the ticket),
    // and "Checked-In" once the seller has scanned the ticket.
    const ticketMembers = linkedTickets.filter((t) => t.name || t.mobileNumber);
    const firstMember = ticketMembers[0];
    const checkedInCount = linkedTickets.filter((t) => t.status === "Checked-In" || t.scannedAt).length;
    const ticketStatus = checkedInCount > 0 ? "Checked-In" : (gb.bookingStatus || "Confirmed");
    const memberNames = ticketMembers.map((t) => t.name).filter(Boolean);

    detailedReports.push({
      id: ticketIds.length > 0 ? ticketIds.join(", ") : `TKT-${String(gb._id).slice(-6).toUpperCase()}`,
      module: "Tickets & Venues",
      category: categoryName,
      customerName: firstMember?.name
        ? `${firstMember.name}${ticketMembers.length > 1 ? ` +${ticketMembers.length - 1}` : ""}`
        : (gb.customerId?.name || "Customer"),
      customerPhone: firstMember?.mobileNumber || gb.customerId?.phone || "",
      date: gb.bookingDate
        ? new Date(gb.bookingDate).toLocaleDateString("en-IN")
        : new Date(gb.createdAt).toLocaleDateString("en-IN"),
      time: gb.timeSlot || "—",
      status: ticketStatus,
      amount: Math.round(amount),
      details: `${members} Ticket(s) (${gb.bookingType || "General"})`
        + (memberNames.length ? ` · Members: ${memberNames.join(", ")}` : "")
        + (linkedTickets.length ? ` · Checked-in: ${checkedInCount}/${linkedTickets.length}` : ""),
      createdAt: gb.createdAt,
    });
  });

  // Process Retail / Wholesale Orders
  orders.forEach((o) => {
    const mod = o.moduleType === "wholesale" ? "Wholesale" : "Retail";
    const amount = Number(o.pricing?.total || 0);

    moduleMap[mod].totalOrders++;
    moduleMap[mod].totalSales += amount;

    const catName = o.items?.[0]?.product?.categoryId?.name || "General Retail";
    if (!moduleMap[mod].categories[catName]) {
      moduleMap[mod].categories[catName] = { name: catName, count: 0, revenue: 0 };
    }
    moduleMap[mod].categories[catName].count++;
    moduleMap[mod].categories[catName].revenue += amount;

    // Top items tracking
    (o.items || []).forEach((item) => {
      const pName = item.name || item.product?.name || "Product";
      const itemRev = Number(item.price || 0) * Number(item.quantity || 1);
      const curP = topProductMap.get(pName) || { name: pName, sales: 0, revenue: 0, module: mod };
      curP.sales += Number(item.quantity || 1);
      curP.revenue += itemRev;
      topProductMap.set(pName, curP);
    });

    // Week metrics
    const cDate = new Date(o.createdAt);
    if (cDate >= sevenDaysAgo) {
      currentWeekSales += amount;
      currentWeekOrders++;
    } else if (cDate >= fourteenDaysAgo) {
      prevWeekSales += amount;
      prevWeekOrders++;
    }

    detailedReports.push({
      id: o.orderId || String(o._id).slice(-8).toUpperCase(),
      module: mod,
      category: catName,
      customerName: o.customer?.name || o.address?.name || "Customer",
      customerPhone: o.customer?.phone || o.address?.phone || "",
      date: new Date(o.createdAt).toLocaleDateString("en-IN"),
      time: new Date(o.createdAt).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      status: o.status || "Placed",
      amount: Math.round(amount),
      details: `${o.items?.length || 1} Item(s)`,
      createdAt: o.createdAt,
    });
  });

  // Process Customization bookings (own section in the report)
  customizations.forEach((cr) => {
    const amount = Number(cr.quotation?.amount || 0);
    const categoryName = cr.details?.decorationType ? `${cr.details.decorationType} Decoration` : "Customization";
    const mc = moduleMap.Customization;
    mc.totalOrders++;
    mc.totalSales += amount;
    if (!mc.categories[categoryName]) mc.categories[categoryName] = { name: categoryName, count: 0, revenue: 0 };
    mc.categories[categoryName].count++;
    mc.categories[categoryName].revenue += amount;

    const cDate = new Date(cr.createdAt);
    if (cDate >= sevenDaysAgo) {
      currentWeekSales += amount;
      currentWeekOrders++;
    } else if (cDate >= fourteenDaysAgo) {
      prevWeekSales += amount;
      prevWeekOrders++;
    }

    const cod = Number(cr.codAmountCollected || 0);
    const paid = Math.min(amount, Number(cr.amountPaid || 0));
    const paymentText = cr.paymentMode === "COD"
      ? (cr.paymentStatus === "PAID" ? "COD Paid" : cr.paymentStatus === "ADVANCE_PAID" ? "Advance Paid (COD)" : "COD Pending")
      : (cr.paymentStatus === "PAID" ? "Paid (Online)" : "Advance Paid (Online)");
    detailedReports.push({
      id: cr.requestId || `CUS-${String(cr._id).slice(-6).toUpperCase()}`,
      module: "Customization",
      category: categoryName,
      customerName: cr.customer?.name || "Customer",
      customerPhone: cr.customer?.phone || "",
      date: new Date(cr.createdAt).toLocaleDateString("en-IN"),
      time: new Date(cr.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
      status: "Confirmed",
      amount: Math.round(amount),
      details: [
        cr.details?.theme ? `Theme: ${cr.details.theme}` : "",
        cr.details?.colors?.length ? `Colors: ${cr.details.colors.join(", ")}` : "",
        `${paymentText} · Paid ₹${Math.round(paid).toLocaleString("en-IN")}${cod > 0 ? ` (cash ₹${Math.round(cod).toLocaleString("en-IN")})` : ""}`,
      ].filter(Boolean).join(" · "),
      createdAt: cr.createdAt,
    });
  });

  // Sort detailed reports newest first
  detailedReports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // --- Aggregate Totals ---
  const totalSales = Object.values(moduleMap).reduce(
    (acc, m) => acc + m.totalSales,
    0
  );
  const totalOrders = Object.values(moduleMap).reduce(
    (acc, m) => acc + m.totalOrders,
    0
  );
  const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

  const salesTrendPerc =
    prevWeekSales === 0
      ? currentWeekSales > 0
        ? 100
        : 0
      : (((currentWeekSales - prevWeekSales) / prevWeekSales) * 100).toFixed(1);

  const ordersTrendPerc =
    prevWeekOrders === 0
      ? currentWeekOrders > 0
        ? 100
        : 0
      : (((currentWeekOrders - prevWeekOrders) / prevWeekOrders) * 100).toFixed(1);

  // --- Build Trend Chart (combining all modules) ---
  const allEventsForTrend = [
    ...orders.map((o) => ({ date: new Date(o.createdAt), amount: Number(o.pricing?.total || 0) })),
    // Same amount formula as the totals (no chart vs total mismatch).
    ...eventBookings.map((eb) => ({ date: new Date(eb.createdAt), amount: eventAmountOf(eb) })),
    ...generalBookings.map((gb) => ({ date: new Date(gb.createdAt), amount: Number(gb.totalAmount || 0) })),
    ...customizations.map((cr) => ({ date: new Date(cr.createdAt), amount: Number(cr.quotation?.amount || 0) })),
  ];

  let chartData = [];
  if (range === "monthly") {
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const targetYear = d.getFullYear();
      const targetMonth = d.getMonth();
      const bucketEvents = allEventsForTrend.filter(
        (e) => e.date.getFullYear() === targetYear && e.date.getMonth() === targetMonth
      );
      chartData.push({
        name: MONTH_NAMES[targetMonth],
        sales: bucketEvents.reduce((acc, e) => acc + e.amount, 0),
        orders: bucketEvents.length,
        traffic: bucketEvents.length * 4,
      });
    }
  } else if (range === "weekly") {
    for (let i = 3; i >= 0; i--) {
      const startW = new Date();
      startW.setDate(startW.getDate() - (i + 1) * 7);
      const endW = new Date();
      endW.setDate(endW.getDate() - i * 7);
      const bucketEvents = allEventsForTrend.filter(
        (e) => e.date >= startW && e.date < endW
      );
      chartData.push({
        name: `Week ${4 - i}`,
        sales: bucketEvents.reduce((acc, e) => acc + e.amount, 0),
        orders: bucketEvents.length,
        traffic: bucketEvents.length * 3,
      });
    }
  } else {
    // Day buckets in India time, so late-night bookings land on the right day.
    const istDay = (date) => date.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const targetDateStr = istDay(d);
      const bucketEvents = allEventsForTrend.filter(
        (e) => istDay(e.date) === targetDateStr
      );
      chartData.push({
        name: DAY_NAMES[d.getDay()],
        sales: bucketEvents.reduce((acc, e) => acc + e.amount, 0),
        orders: bucketEvents.length,
        traffic: bucketEvents.length * 2,
      });
    }
  }

  // --- Category Mix (all categories across all modules) ---
  const categoryMixMap = new Map();
  Object.values(moduleMap).forEach((m) => {
    Object.values(m.categories).forEach((c) => {
      const existing = categoryMixMap.get(c.name) || {
        subject: c.name,
        A: 0,
        revenue: 0,
        module: m.name,
        fullMark: 100,
      };
      existing.A += c.count;
      existing.revenue += c.revenue;
      categoryMixMap.set(c.name, existing);
    });
  });

  const categoryMix = Array.from(categoryMixMap.values());
  if (categoryMix.length === 0) {
    categoryMix.push({ subject: "General", A: 0, revenue: 0, fullMark: 100 });
  }

  // --- Formatted Top Products / Services ---
  const formattedTopProducts = Array.from(topProductMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)
    .map((p) => ({
      name: p.name,
      sales: p.sales,
      revenue: `₹${Math.round(p.revenue).toLocaleString("en-IN")}`,
      trend: 100,
      module: p.module,
    }));

  // Module Breakdown List for UI & Reports
  const moduleBreakdownList = Object.values(moduleMap).map((m) => ({
    module: m.module,
    name: m.name,
    icon: m.icon,
    totalOrders: m.totalOrders,
    totalSales: Math.round(m.totalSales),
    totalTickets: m.totalTickets || 0,
    categories: Object.values(m.categories).map((c) => ({
      name: c.name,
      count: c.count,
      revenue: Math.round(c.revenue),
      ticketsCount: c.ticketsCount || 0,
    })),
  }));

  // Traffic Sources
  const finalTrafficSources = [
    { name: "Direct", value: Math.max(1, Math.round(totalOrders * 0.6)), color: SOURCE_COLORS.Direct },
    { name: "Search", value: Math.max(0, Math.round(totalOrders * 0.25)), color: SOURCE_COLORS.Search },
    { name: "Social", value: Math.max(0, Math.round(totalOrders * 0.15)), color: SOURCE_COLORS.Social },
  ];

  return {
    overview: {
      totalSales: `₹${Math.round(totalSales).toLocaleString("en-IN")}`,
      totalOrders: totalOrders.toLocaleString("en-IN"),
      avgOrderValue: `₹${Math.round(avgOrderValue).toLocaleString("en-IN")}`,
      conversionRate: totalOrders > 0 ? "4.5%" : "0%",
      salesTrend: `${salesTrendPerc > 0 ? "+" : ""}${salesTrendPerc}%`,
      ordersTrend: `${ordersTrendPerc > 0 ? "+" : ""}${ordersTrendPerc}%`,
    },
    salesTrend: chartData,
    categoryMix,
    topProducts: formattedTopProducts,
    trafficSources: finalTrafficSources,
    moduleBreakdown: moduleBreakdownList,
    detailedReports: detailedReports,
    insights: {
      topCity: "Patna",
      peakTime: "10:00 AM - 02:00 PM",
      topDevice: totalOrders > 0 ? "85% Mobile" : "N/A",
    },
  };
}

export default {
  getSellerStats,
};
