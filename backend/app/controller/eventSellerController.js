import mongoose from "mongoose";
import Seller from "../models/seller.js";
import SellerAvailability from "../models/event/SellerAvailability.js";
import SellerReservation from "../models/event/SellerReservation.js";

export const searchEventSellers = async (req, res) => {
  try {
    const { date, time, guestCount, location, categories, budget } = req.query;

    if (!date || !guestCount || !categories) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "Date, guest count, and categories are required fields",
      });
    }

    const requestedDate = new Date(date);
    requestedDate.setHours(0, 0, 0, 0);
    
    const guests = parseInt(guestCount, 10);
    const categoryIds = categories.split(',').map(id => id.trim());

    // 1. Initial query: Verified sellers matching categories and base capacity
    const query = {
      isEventSeller: true,
      $or: [
        { sellerStatus: 'active', sellerVerificationStatus: 'verified' },
        { isActive: true, isVerified: true }
      ],
      serviceCategories: { $in: categoryIds },
      maxGuestCapacity: { $gte: guests },
    };

    const sellers = await Seller.find(query).populate('serviceCategories').lean();

    if (!sellers || sellers.length === 0) {
      return res.status(200).json({
        success: true,
        error: false,
        message: "No sellers found matching criteria",
        result: [],
      });
    }

    // 2. Validate Availability and Reservations for each seller
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
      
      // Also check active reservations locking the capacity
      const activeReservations = await SellerReservation.find({
        sellerId: seller._id,
        status: "active",
        reservationExpiryTime: { $gt: new Date() },
      });

      // Assuming each reservation locks max capacity of that specific booking
      // For Phase 1, we simply count reservations as 1 event.
      // If seller reached maxEventsPerDay, skip.
      const currentBookingsAndReservations = activeReservations.length + (bookedCapacity > 0 ? 1 : 0); // Simplified for Phase 1

      if (currentBookingsAndReservations >= seller.maxEventsPerDay) {
        continue; // Seller is fully booked for the day
      }

      // Check service radius if location coordinates are provided
      // (Future implementation for geospatial matching)
      
      // If all checks pass, add to results
      availableSellers.push(seller);
    }

    return res.status(200).json({
      success: true,
      error: false,
      message: "Available sellers fetched successfully",
      result: availableSellers,
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
