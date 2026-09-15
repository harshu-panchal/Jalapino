import mongoose from "mongoose";
import Seller from "../models/seller.js";
import SellerAvailability from "../models/event/SellerAvailability.js";
import SellerReservation from "../models/event/SellerReservation.js";
import SellerPackage from "../models/event/SellerPackage.js";
import { getNearbySellerIdsForCustomer } from "../services/customerVisibilityService.js";

export const searchEventSellers = async (req, res) => {
  try {
    const { date, time, guestCount, location, categories, budget, lat, lng } = req.query;

    if (!categories) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "categories is required",
      });
    }

    const categoryIds = categories.split(',').map(id => id.trim()).filter(Boolean);

    // Fetch category names for categoryIds to allow matching seller category/mainProducts by string
    let catNames = [];
    if (categoryIds.length > 0) {
      try {
        const EventCategory = (await import("../models/event/EventCategory.js")).default;
        const matchedCats = await EventCategory.find({ _id: { $in: categoryIds } }).lean();
        catNames = matchedCats.map((c) => c.name).filter(Boolean);
      } catch (err) {
        console.error("Error fetching EventCategory names:", err);
      }
    }

    const catOrConditions = [
      { serviceCategories: { $in: categoryIds } }
    ];
    catNames.forEach((name) => {
      const reg = new RegExp(name.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&"), "i");
      catOrConditions.push({ category: reg });
      catOrConditions.push({ mainProducts: reg });
    });
    // NOTE: Removed hardcoded decoration|balloon fallbacks — they caused all event
    // sellers to bleed into every category search regardless of selected category.

    // 1. Flexible query: active event sellers matching category & location
    const query = {
      isShopActive: { $ne: false },
      $or: [
        { sellerStatus: "active", sellerVerificationStatus: "verified" },
        { isActive: true, isVerified: true },
      ],
      $and: [
        {
          $or: [
            { isEventSeller: true },
            { planMyEventEnabled: true },
            { eventDetailsEnabled: true },
          ],
        },
        { $or: catOrConditions },
      ],
    };

    // Apply guest count filter only if provided
    if (guestCount) {
      const guests = parseInt(guestCount, 10);
      if (!isNaN(guests)) {
        query.maxGuestCapacity = { $gte: guests };
      }
    }

    if (lat && lng) {
      const nearbySellerIds = await getNearbySellerIdsForCustomer(lat, lng);
      query.$and.push({
        _id: { $in: nearbySellerIds }
      });
    } else if (location) {
      // Split location by comma and filter out noise: country name, 6-digit pincodes,
      // pincode+state combos, very short tokens, and state names
      const rawParts = location.split(",").map((p) => p.trim()).filter(Boolean);
      const states = ["andhra pradesh", "arunachal pradesh", "assam", "bihar", "chhattisgarh", "goa", "gujarat", "haryana", "himachal pradesh", "jharkhand", "karnataka", "kerala", "madhya pradesh", "maharashtra", "manipur", "meghalaya", "mizoram", "nagaland", "odisha", "punjab", "rajasthan", "sikkim", "tamil nadu", "telangana", "tripura", "uttar pradesh", "uttarakhand", "west bengal", "delhi", "jammu", "kashmir", "ladakh", "puducherry", "chandigarh"];
      const meaningfulParts = rawParts.filter((p) => {
        const pl = p.toLowerCase();
        if (/^india$/i.test(p)) return false; // skip "India"
        if (/^\d{6}$/.test(p)) return false; // skip pure pincode
        if (/^[a-z\s]+\s+\d{6}$/i.test(p)) return false; // skip "Bihar 800030"
        if (states.includes(pl)) return false; // skip state names
        if (p.length < 3) return false; // skip very short
        return true;
      });

      // Use only meaningful parts for regex — prefer city-level match
      const searchParts = meaningfulParts.length > 0 ? meaningfulParts : rawParts;
      const regexes = searchParts.map((p) => new RegExp(p.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&"), "i"));

      // Match strictly on city field only — address/locality text can contain
      // other city names (e.g. "Near Bhopal Road, Indore") causing false matches
      const cityRegexes = searchParts.map(
        (p) => new RegExp(`^${p.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i')
      );
      query.$and.push({
        $or: [
          { city: { $in: cityRegexes } },
          { "customZones.city": { $in: cityRegexes } },
        ],
      });
    }

    console.log("DEBUG: searchEventSellers Query ->", JSON.stringify(query, null, 2));

    // ── DEBUG: ALL event sellers in DB (no filters) ──
    const allEventSellers = await Seller.find({ isEventSeller: true })
      .select('name shopName city state isEventSeller isActive isVerified sellerStatus sellerVerificationStatus isShopActive serviceCategories serviceCoverage category mainProducts')
      .populate('serviceCategories', 'name')
      .lean();
    console.log("\n==== ALL EVENT SELLERS IN DB ====");
    allEventSellers.forEach((s, i) => {
      const catNames = (s.serviceCategories || []).map(c => c?.name || c).join(', ');
      console.log(`[${i + 1}] ${s.shopName || s.name} | city: ${s.city} | serviceCategories: [${catNames}] | category text: "${s.category}" | mainProducts text: "${s.mainProducts}"`);
    });
    if (allEventSellers.length === 0) console.log("  ❌ NO EVENT SELLERS FOUND! isEventSeller:true wala koi seller DB mein nahi hai!");
    console.log("================================\n");

    const sellers = await Seller.find(query).populate('serviceCategories').lean();
    console.log(`DEBUG: Found ${sellers?.length || 0} sellers for this query`);

    if (!sellers || sellers.length === 0) {
      return res.status(200).json({
        success: true,
        error: false,
        message: "No sellers found matching criteria",
        result: [],
      });
    }

    // 2. If date provided, validate Availability and Reservations for each seller
    if (date) {
      const requestedDate = new Date(date);
      requestedDate.setHours(0, 0, 0, 0);

      const availableSellers = [];

      for (const seller of sellers) {
        // Check Holiday & Blocked Dates
        const availability = await SellerAvailability.findOne({
          sellerId: seller._id,
          date: requestedDate,
        });

        if (availability && availability.holidayFlag) {
          continue; // Seller is on holiday
        }

        // Check max capacity vs current booked capacity
        let bookedCapacity = availability ? availability.currentBookedCapacity : 0;

        // Also check active reservations
        const activeReservations = await SellerReservation.find({
          sellerId: seller._id,
          status: "active",
          reservationExpiryTime: { $gt: new Date() },
        });

        const currentBookingsAndReservations = activeReservations.length + (bookedCapacity > 0 ? 1 : 0);

        if (seller.maxEventsPerDay && currentBookingsAndReservations >= seller.maxEventsPerDay) {
          continue; // Seller is fully booked for the day
        }

        availableSellers.push({ ...seller, isAvailable: true });
      }

      return res.status(200).json({
        success: true,
        error: false,
        message: "Available sellers fetched successfully",
        result: availableSellers,
      });
    }

    // No date filter — return all sellers with availability unknown
    return res.status(200).json({
      success: true,
      error: false,
      message: "Sellers fetched successfully",
      result: sellers,
    });

  } catch (error) {
    console.error("Error searching event sellers:", error);
    return res.status(500).json({
      success: false,
      error: true,
      message: error.message || "Failed to search sellers",
    });
  }
};


export const getSellerPackagesPublic = async (req, res) => {
  try {
    const { sellerId } = req.params;

    // Fetch packages that are available
    const packages = await SellerPackage.find({
      seller: sellerId,
      availability: true
    })
      .populate('category', 'name activePlugins')
      .populate('template', 'packageName includedFeatures optionalFeatures description images')
      .lean();

    return res.status(200).json({
      success: true,
      error: false,
      message: "Seller packages fetched successfully",
      result: packages,
    });
  } catch (error) {
    console.error("Error fetching seller packages:", error);
    return res.status(500).json({
      success: false,
      error: true,
      message: error.message || "Failed to fetch seller packages",
    });
  }
};

export const getAreaSellers = async (req, res) => {
  try {
    const { city } = req.query;
    let query = {
      isEventSeller: true,
      $or: [
        { sellerStatus: 'active', sellerVerificationStatus: 'verified' },
        { isActive: true, isVerified: true }
      ]
    };

    // If a specific location/city is provided
    if (city) {
      query.$and = [
        {
          $or: [
            { city: { $regex: new RegExp(city, "i") } },
            { address: { $regex: new RegExp(city, "i") } },
            { locality: { $regex: new RegExp(city, "i") } },
            { state: { $regex: new RegExp(city, "i") } },
            { "customZones.city": { $regex: new RegExp(city, "i") } }
          ]
        }
      ];
    }

    // Fetch sellers that have some location set
    const sellers = await Seller.find(query)
      .select('shopName name city customZones profileImage')
      .limit(10)
      .lean();

    return res.status(200).json({
      success: true,
      error: false,
      result: sellers,
    });
  } catch (error) {
    console.error("Error fetching area sellers:", error);
    return res.status(500).json({
      success: false,
      error: true,
      message: error.message || "Failed to fetch area sellers",
    });
  }
};

// Get booked dates for a specific seller (used by customer app)
export const getSellerBookedDates = async (req, res) => {
  try {
    const { sellerId } = req.params;
    const { date } = req.query; // optional: filter by specific date (YYYY-MM-DD)

    if (!sellerId || !mongoose.Types.ObjectId.isValid(sellerId)) {
      return res.status(400).json({ success: false, message: "Valid sellerId is required" });
    }

    const EventBooking = (await import('../models/event/EventBooking.js')).default;
    const SellerCalendar = (await import('../models/event/SellerCalendar.js')).default;

    // Check if seller has blocked this date
    let isBlocked = false;
    if (date) {
      const calendarDoc = await SellerCalendar.findOne({ seller: new mongoose.Types.ObjectId(sellerId) }).lean();
      if (calendarDoc && Array.isArray(calendarDoc.blockedDates)) {
        isBlocked = calendarDoc.blockedDates.some(b => {
          const blockedDateStr = (b.date || '').trim();
          return blockedDateStr === date;
        });
      }
    }

    // Build query: bookings where this seller is assigned
    const query = {
      "services.seller": new mongoose.Types.ObjectId(sellerId),
      "services": {
        $elemMatch: {
          seller: new mongoose.Types.ObjectId(sellerId),
          status: { $in: ['ACCEPTED', 'PENDING_APPROVAL', 'COMPLETED'] }
        }
      }
    };

    // If specific date provided, filter for that day
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      query.eventDate = { $gte: startOfDay, $lte: endOfDay };
    }

    const bookings = await EventBooking.find(query)
      .select('eventDate eventTime eventType guestCount services')
      .lean();

    // Format response - only show non-sensitive info to customer
    const bookedDates = bookings.map(b => {
      const sellerService = b.services.find(s => s.seller?.toString() === sellerId.toString());
      return {
        date: b.eventDate,
        time: b.eventTime || null,
        eventType: b.eventType || null,
        guestCount: b.guestCount || null,
        status: sellerService?.status || 'PENDING_APPROVAL',
        remark: sellerService?.specialInstructions || null,
      };
    });

    return res.status(200).json({
      success: true,
      result: bookedDates,
      isBlocked,   // true if seller manually blocked this date
    });
  } catch (error) {
    console.error("Error fetching seller booked dates:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch booked dates",
    });
  }
};
