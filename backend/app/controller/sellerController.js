import Seller from "../models/seller.js";
import Transaction from "../models/transaction.js";
import { handleResponse, calculateDistance } from "../utils/helper.js";
import mongoose from "mongoose";
import { invalidateSellerName } from "../services/entityNameCache.js";
import { saveRawFile } from "../services/localStorageService.js";

/* ===============================
   GET NEARBY SELLERS
================================ */
export const getNearbySellers = async (req, res) => {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return handleResponse(res, 400, "Latitude and longitude are required");
    }

    const customerLat = Number(lat);
    const customerLng = Number(lng);

    // Fetch all active/verified sellers
    // We could use $geoNear, but to strictly follow the requirement of individual radii,
    // we'll fetch sellers within a reasonable max distance (e.g. 100km) and then filter.
    const sellers = await Seller.find({
      isActive: true,
      isVerified: true,
      isShopActive: { $ne: false },
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [customerLng, customerLat],
          },
          $maxDistance: 100000, // 100km max search area for performance
        },
      },
    }).lean();

    // Helper to check if current time is within open/close hours
    const isWithinOperatingHours = (openingTime, closingTime) => {
        if (!openingTime || !closingTime) return true; // Fail safe
        
        const now = new Date();
        const istOffset = 5.5 * 60 * 60 * 1000;
        const istTime = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + istOffset);
        
        const currentHours = istTime.getHours();
        const currentMinutes = istTime.getMinutes();
        const currentTotalMinutes = currentHours * 60 + currentMinutes;

        const parseTimeStr = (timeStr) => {
            const [time, modifier] = timeStr.split(' ');
            let [hours, minutes] = time.split(':');
            hours = parseInt(hours, 10);
            minutes = parseInt(minutes, 10);
            
            if (hours === 12) {
                hours = modifier.toUpperCase() === 'PM' ? 12 : 0;
            } else if (modifier.toUpperCase() === 'PM') {
                hours += 12;
            }
            return hours * 60 + minutes;
        };

        const openTotalMinutes = parseTimeStr(openingTime);
        const closeTotalMinutes = parseTimeStr(closingTime);

        if (closeTotalMinutes > openTotalMinutes) {
            return currentTotalMinutes >= openTotalMinutes && currentTotalMinutes <= closeTotalMinutes;
        } else {
            // Closes next day (e.g. 10 PM to 2 AM)
            return currentTotalMinutes >= openTotalMinutes || currentTotalMinutes <= closeTotalMinutes;
        }
    };

    // Filter based on individual service radius and timings
    const nearbySellers = sellers.filter((seller) => {
      // Check timings
      if (seller.shopTimingsEnabled) {
          if (!isWithinOperatingHours(seller.shopOpeningTime, seller.shopClosingTime)) {
              return false; // Skip this seller if outside operating hours
          }
      }

      const sellerLng = seller.location.coordinates[0];
      const sellerLat = seller.location.coordinates[1];
      const distance = calculateDistance(
        customerLat,
        customerLng,
        sellerLat,
        sellerLng,
      );

      // Add distance to seller object for frontend
      seller.distance = distance;

      return distance <= (seller.serviceRadius || 5);
    });

    // --- RELIABILITY ENGINE: Sort by score descending ---
    nearbySellers.sort((a, b) => {
      const scoreA = a.reliabilityScore !== undefined ? a.reliabilityScore : 100;
      const scoreB = b.reliabilityScore !== undefined ? b.reliabilityScore : 100;
      return scoreB - scoreA;
    });

    return handleResponse(
      res,
      200,
      "Nearby sellers fetched successfully",
      nearbySellers,
    );
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   REQUEST WITHDRAWAL (Seller)
================================ */
export const requestWithdrawal = async (req, res) => {
  try {
    const sellerId = req.user.id;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return handleResponse(res, 400, "Please enter a valid amount");
    }

    // 1. Calculate current available balance
    // Consistent with getSellerEarnings logic in sellerStatsController.js
    const transactions = await Transaction.find({
      user: sellerId,
      userModel: "Seller",
    })
      .select("status amount type")
      .lean();

    const settledBalance = transactions
      .filter((t) => t.status === "Settled")
      .reduce((acc, t) => acc + (t.amount || 0), 0);

    const pendingPayouts = transactions
      .filter(
        (t) =>
          t.type === "Withdrawal" &&
          (t.status === "Pending" || t.status === "Processing"),
      )
      .reduce((acc, t) => acc + Math.abs(t.amount || 0), 0);

    const availableBalance = settledBalance - pendingPayouts;

    if (amount > availableBalance) {
      return handleResponse(
        res,
        400,
        `Insufficient balance. Available: ₹${availableBalance}`,
      );
    }

    // 2. Create Withdrawal Transaction
    // Withdrawals have negative amounts per the model comment
    const withdrawal = await Transaction.create({
      user: sellerId,
      userModel: "Seller",
      type: "Withdrawal",
      amount: -Math.abs(amount),
      status: "Pending",
      reference: `WDR-${Date.now()}`,
    });

    return handleResponse(
      res,
      201,
      "Withdrawal request submitted successfully",
      withdrawal,
    );
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   GET SELLER PROFILE
================================ */

export const getSellerProfile = async (req, res) => {
  try {
    const seller = await Seller.findById(req.user.id);
    if (!seller) {
      return handleResponse(res, 404, "Seller not found");
    }
    return handleResponse(
      res,
      200,
      "Seller profile fetched successfully",
      seller,
    );
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   UPDATE SELLER PROFILE
================================ */
export const updateSellerProfile = async (req, res) => {
  try {
    const { name, shopName, phone, address, locality, pincode, city, state, lat, lng, radius, serviceCoverage, customZones, advancePaymentPercentage, isShopActive, shopTimingsEnabled, shopOpeningTime, shopClosingTime } = req.body;

    // Find seller
    const seller = await Seller.findById(req.user.id);
    import('fs').then(fs => fs.appendFileSync('update.log', JSON.stringify(req.body) + '\n'));
    if (!seller) {
      return handleResponse(res, 404, "Seller not found");
    }

    const documentFiles = req.files || [];
    const uploadedBanners = [];

    if (Array.isArray(documentFiles) && documentFiles.length > 0) {
        for (const file of documentFiles) {
            try {
                const fieldName = file.fieldname;
                const isBanner = fieldName === 'banners' || fieldName.startsWith('banner');
                if (isBanner) {
                    let url = await saveRawFile(file.buffer, "banners", file.originalname);
                    const reqDomain = `${req.protocol}://${req.get("host")}`;
                    const envDomain = process.env.API_DOMAIN || "http://localhost:7000";
                    if (url.startsWith("/")) url = `${reqDomain}${url}`;
                    
                    if (url.includes("localhost") || url.includes("host:7000") || url.startsWith("http://10.0.2.2")) {
                        if (url.startsWith(envDomain)) url = url.replace(envDomain, reqDomain);
                        else if (url.startsWith("host:7000")) url = url.replace("host:7000", reqDomain);
                        else if (url.startsWith("http://host:7000")) url = url.replace("http://host:7000", reqDomain);
                    }
                    uploadedBanners.push(url);
                }
            } catch (err) {
                console.error("Failed to upload banner", err);
            }
        }
    }

    // In updateProfile, we either replace existing banners or append.
    // If the client sends `keptBanners` (JSON string array), we keep those, and add the new `uploadedBanners`.
    let finalBanners = [...(seller.banners || [])];
    
    if (req.body.keptBanners !== undefined) {
      try {
        finalBanners = JSON.parse(req.body.keptBanners);
      } catch (e) {
        console.error("Failed to parse keptBanners", e);
      }
    }
    
    seller.banners = [...finalBanners, ...uploadedBanners];

    // Update fields if provided
    if (name) seller.name = name;
    if (shopName) seller.shopName = shopName;
    if (phone) seller.phone = phone;
    if (address !== undefined) seller.address = address;
    if (locality !== undefined) seller.locality = locality;
    if (pincode !== undefined) seller.pincode = pincode;
    if (city !== undefined) seller.city = city;
    if (state !== undefined) seller.state = state;
    if (advancePaymentPercentage !== undefined) seller.advancePaymentPercentage = Number(advancePaymentPercentage);
    if (req.body.minGuestCapacity !== undefined) seller.minGuestCapacity = Number(req.body.minGuestCapacity);
    if (req.body.maxGuestCapacity !== undefined) seller.maxGuestCapacity = Number(req.body.maxGuestCapacity);
    if (req.body.totalCapacity !== undefined) seller.totalCapacity = Number(req.body.totalCapacity);
    if (req.body.bookingType !== undefined) seller.bookingType = req.body.bookingType;
    if (req.body.numberOfShops !== undefined) seller.numberOfShops = Number(req.body.numberOfShops);

    if (req.body.addonDecorationEnabled !== undefined) seller.addonDecorationEnabled = req.body.addonDecorationEnabled === 'true' || req.body.addonDecorationEnabled === true;
    if (req.body.addonDecorationPrice !== undefined) seller.addonDecorationPrice = Number(req.body.addonDecorationPrice);
    if (req.body.addonBridalEnabled !== undefined) seller.addonBridalEnabled = req.body.addonBridalEnabled === 'true' || req.body.addonBridalEnabled === true;
    if (req.body.addonBridalPrice !== undefined) seller.addonBridalPrice = Number(req.body.addonBridalPrice);
    if (req.body.addonCateringEnabled !== undefined) seller.addonCateringEnabled = req.body.addonCateringEnabled === 'true' || req.body.addonCateringEnabled === true;
    if (req.body.addonCateringPrice !== undefined) seller.addonCateringPrice = Number(req.body.addonCateringPrice);
    if (req.body.physicalPaymentEnabled !== undefined) seller.physicalPaymentEnabled = req.body.physicalPaymentEnabled === 'true' || req.body.physicalPaymentEnabled === true;
    if (req.body.paymentQrCode !== undefined) seller.paymentQrCode = req.body.paymentQrCode;

    // Shop Operation Settings
    if (isShopActive !== undefined) seller.isShopActive = isShopActive === 'true' || isShopActive === true;
    if (shopTimingsEnabled !== undefined) seller.shopTimingsEnabled = shopTimingsEnabled === 'true' || shopTimingsEnabled === true;
    if (shopOpeningTime !== undefined) seller.shopOpeningTime = shopOpeningTime;
    if (shopClosingTime !== undefined) seller.shopClosingTime = shopClosingTime;

    if (serviceCoverage !== undefined) {
      if (typeof serviceCoverage === "string") {
        try {
          seller.serviceCoverage = JSON.parse(serviceCoverage);
        } catch (e) {
          seller.serviceCoverage = serviceCoverage.split(",").map(s => s.trim());
        }
      } else {
        seller.serviceCoverage = serviceCoverage;
      }
    }

    if (customZones !== undefined) {
      if (typeof customZones === "string") {
        try {
          seller.customZones = JSON.parse(customZones);
        } catch (e) {
          console.error("Failed to parse customZones", e);
        }
      } else {
        seller.customZones = customZones;
      }
    }

    // Validate and update geo data
    if (lat !== undefined && lng !== undefined) {
      if (lat < -90 || lat > 90)
        return handleResponse(res, 400, "Invalid latitude");
      if (lng < -180 || lng > 180)
        return handleResponse(res, 400, "Invalid longitude");

      seller.location = {
        type: "Point",
        coordinates: [Number(lng), Number(lat)],
      };
    }

    if (radius !== undefined) {
      if (radius < 1 || radius > 100)
        return handleResponse(res, 400, "Radius must be between 1 and 100 km");
      seller.serviceRadius = Number(radius);
    }

    const updatedSeller = await seller.save();

    // Invalidate cached seller name in case shopName changed
    invalidateSellerName(req.user.id).catch((err) => {
      console.warn("[Seller] Name cache invalidation failed:", err.message);
    });

    return handleResponse(
      res,
      200,
      "Profile updated successfully",
      updatedSeller,
    );
  } catch (error) {
    // Handle duplicate phone error
    if (error.code === 11000) {
      return handleResponse(res, 400, "Phone number already in use");
    }
    return handleResponse(res, 500, error.message);
  }
};


