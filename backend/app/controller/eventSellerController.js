import mongoose from "mongoose";
import Seller from "../models/seller.js";
import SellerAvailability from "../models/event/SellerAvailability.js";
import SellerReservation from "../models/event/SellerReservation.js";
import SellerPackage from "../models/event/SellerPackage.js";

export const searchEventSellers = async (req, res) => {
  try {
    const { date, time, guestCount, location, categories, budget } = req.query;

    if (!categories) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "categories is required",
      });
    }

    const categoryIds = categories.split(',').map(id => id.trim()).filter(Boolean);

    // 1. Base query: active event sellers with the matching service categories
    const query = {
      isEventSeller: true,
      $or: [
        { sellerStatus: 'active', sellerVerificationStatus: 'verified' },
        { isActive: true, isVerified: true }
      ],
      serviceCategories: { $in: categoryIds },
    };

    // Apply guest count filter only if provided
    if (guestCount) {
      const guests = parseInt(guestCount, 10);
      if (!isNaN(guests)) {
        query.maxGuestCapacity = { $gte: guests };
      }
    }

    // Apply location filtering if provided
    if (location) {
      query.$and = [
        {
          $or: [
            { city: { $regex: new RegExp(location, "i") } },
            { "customZones.city": { $regex: new RegExp(location, "i") } }
          ]
        }
      ];
    }

    const sellers = await Seller.find(query).populate('serviceCategories').lean();

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
