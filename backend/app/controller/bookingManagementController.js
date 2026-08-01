import BookingManagement from '../models/bookingManagement.js';
import SellerCalendar from '../models/event/SellerCalendar.js';
import handleResponse from '../utils/helper.js';

// Helper to auto-lock date in Seller Calendar
async function autoLockCalendarDate(sellerId, bookingDate, reason = "Auto-locked by Booking") {
  try {
    const formattedDate = new Date(bookingDate).toISOString().split('T')[0];
    let calendar = await SellerCalendar.findOne({ seller: sellerId });
    if (!calendar) {
      calendar = new SellerCalendar({ seller: sellerId, blockedDates: [] });
    }
    
    const isAlreadyBlocked = calendar.blockedDates.some(bd => bd.date === formattedDate);
    if (!isAlreadyBlocked) {
      calendar.blockedDates.push({
        date: formattedDate,
        reason: reason,
        type: 'FULL_CAPACITY',
      });
      await calendar.save();
    }
  } catch (err) {
    console.error("Failed to auto-lock calendar slot:", err);
  }
}

// Create Offline Booking (Seller side)
export const createOfflineBooking = async (req, res) => {
  try {
    const sellerId = req.user.id;
    const {
      customerName,
      address,
      mobileNumber,
      bookingDate,
      timeSlot,
      bookingStatus,
      guestsCount,
      paymentEntryDate,
      advancePaymentAmount,
      totalBookingAmount,
      totalPaidAmount,
      remarks,
    } = req.body;

    const dueAmount = Math.max(0, Number(totalBookingAmount || 0) - Number(totalPaidAmount || 0));

    const booking = new BookingManagement({
      sellerId,
      type: 'offline',
      customerName,
      address,
      mobileNumber,
      bookingDate,
      timeSlot,
      bookingStatus,
      guestsCount,
      paymentEntryDate,
      advancePaymentAmount,
      totalBookingAmount,
      totalPaidAmount,
      paymentDueAmount: dueAmount,
      remarks,
    });

    await booking.save();

    // Auto-lock if status is Booked
    if (bookingStatus === 'Booked') {
      await autoLockCalendarDate(sellerId, bookingDate, `Manual Booking for ${customerName}`);
    }

    return handleResponse(res, 201, 'Offline booking created successfully', booking);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// Get bookings (Seller side)
export const getSellerBookings = async (req, res) => {
  try {
    const sellerId = req.user.id;
    const { status, type } = req.query;

    const query = { sellerId };
    if (status && status !== 'all') {
      query.bookingStatus = status;
    }
    if (type && type !== 'all') {
      query.type = type;
    }

    const bookings = await BookingManagement.find(query).sort({ bookingDate: 1 });
    return handleResponse(res, 200, 'Bookings fetched successfully', bookings);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// Update Booking Status / Payment
export const updateBooking = async (req, res) => {
  try {
    const sellerId = req.user.id;
    const { id } = req.params;
    const {
      customerName,
      address,
      mobileNumber,
      bookingDate,
      timeSlot,
      bookingStatus,
      guestsCount,
      paymentEntryDate,
      advancePaymentAmount,
      totalBookingAmount,
      totalPaidAmount,
      remarks,
    } = req.body;

    const updateData = {};
    if (customerName) updateData.customerName = customerName;
    if (address !== undefined) updateData.address = address;
    if (mobileNumber) updateData.mobileNumber = mobileNumber;
    if (bookingDate) updateData.bookingDate = bookingDate;
    if (timeSlot) updateData.timeSlot = timeSlot;
    if (bookingStatus) updateData.bookingStatus = bookingStatus;
    if (guestsCount !== undefined) updateData.guestsCount = guestsCount;
    if (paymentEntryDate !== undefined) updateData.paymentEntryDate = paymentEntryDate;
    if (advancePaymentAmount !== undefined) updateData.advancePaymentAmount = advancePaymentAmount;
    if (totalBookingAmount !== undefined) updateData.totalBookingAmount = totalBookingAmount;
    if (totalPaidAmount !== undefined) updateData.totalPaidAmount = totalPaidAmount;
    if (remarks !== undefined) updateData.remarks = remarks;

    // Recalculate Due Amount if amounts are updated
    if (totalBookingAmount !== undefined || totalPaidAmount !== undefined) {
      const currentBooking = await BookingManagement.findById(id);
      const total = totalBookingAmount !== undefined ? totalBookingAmount : currentBooking.totalBookingAmount;
      const paid = totalPaidAmount !== undefined ? totalPaidAmount : currentBooking.totalPaidAmount;
      updateData.paymentDueAmount = Math.max(0, Number(total || 0) - Number(paid || 0));
    }

    const booking = await BookingManagement.findOneAndUpdate(
      { _id: id, sellerId },
      { $set: updateData },
      { new: true }
    );

    if (!booking) {
      return handleResponse(res, 404, 'Booking not found');
    }

    // Auto-lock if status updated to Booked
    if (bookingStatus === 'Booked') {
      await autoLockCalendarDate(sellerId, booking.bookingDate, `Manual Booking for ${booking.customerName}`);
    }

    return handleResponse(res, 200, 'Booking updated successfully', booking);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// Delete Booking
export const deleteBooking = async (req, res) => {
  try {
    const sellerId = req.user.id;
    const { id } = req.params;

    const booking = await BookingManagement.findOneAndDelete({ _id: id, sellerId });
    if (!booking) {
      return handleResponse(res, 404, 'Booking not found');
    }

    return handleResponse(res, 200, 'Booking deleted successfully');
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// Request Physical Visit
export const requestPhysicalVisit = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await BookingManagement.findByIdAndUpdate(
      id,
      { $set: { physicalVisitRequired: true, physicalVisitStatus: 'Requested' } },
      { new: true }
    );
    if (!booking) {
      return handleResponse(res, 404, 'Booking not found');
    }

    // Real-time socket notification to seller
    const io = req.app.get('io');
    if (io) {
      io.to(booking.sellerId.toString()).emit('physicalVisitRequested', {
        bookingId: booking._id,
        customerName: booking.customerName,
        message: `Physical Visit requested by ${booking.customerName}`
      });
    }

    return handleResponse(res, 200, 'Physical visit requested successfully', booking);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// Confirm Physical Visit (Seller)
export const confirmPhysicalVisit = async (req, res) => {
  try {
    const sellerId = req.user.id;
    const { id } = req.params;
    const booking = await BookingManagement.findOneAndUpdate(
      { _id: id, sellerId },
      { $set: { physicalVisitStatus: 'Confirmed' } },
      { new: true }
    );
    if (!booking) {
      return handleResponse(res, 404, 'Booking not found or unauthorized');
    }

    // Real-time socket notification to customer
    const io = req.app.get('io');
    if (io) {
      io.emit('physicalVisitConfirmed', {
        bookingId: booking._id,
        message: 'Your physical visit request has been confirmed by the seller.'
      });
    }

    return handleResponse(res, 200, 'Physical visit confirmed successfully', booking);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// Complete Physical Visit (Seller)
export const completePhysicalVisit = async (req, res) => {
  try {
    const sellerId = req.user.id;
    const { id } = req.params;
    const booking = await BookingManagement.findOneAndUpdate(
      { _id: id, sellerId },
      { $set: { physicalVisitStatus: 'Completed' } },
      { new: true }
    );
    if (!booking) {
      return handleResponse(res, 404, 'Booking not found or unauthorized');
    }

    return handleResponse(res, 200, 'Physical visit marked as completed', booking);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// Submit Rating/Review for Seller (Customer)
export const submitSellerReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, review } = req.body;

    const booking = await BookingManagement.findById(id);
    if (!booking) {
      return handleResponse(res, 404, 'Booking not found');
    }

    // Validation: Category-wise ON/OFF for Seller reviews
    const Seller = await import('../models/seller.js').then((m) => m.default);
    const seller = await Seller.findById(booking.sellerId);
    if (seller) {
      const reviewCategoriesEnabled = seller.reviewCategoriesEnabled || [];
      const sellerCats = seller.serviceCategories || [];
      const isEnabled = sellerCats.some((catId) =>
        reviewCategoriesEnabled.map(String).includes(String(catId))
      );
      if (!isEnabled && reviewCategoriesEnabled.length > 0) {
        return handleResponse(
          res,
          400,
          "Reviews are disabled for this seller's category by the admin."
        );
      }
    }

    booking.sellerRatingByCustomer = rating;
    booking.sellerReviewByCustomer = review;
    await booking.save();

    return handleResponse(res, 200, 'Review submitted successfully', booking);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// Submit Rating/Review for Customer (Seller)
export const submitCustomerReview = async (req, res) => {
  try {
    const sellerId = req.user.id;
    const { id } = req.params;
    const { rating, review } = req.body;

    const booking = await BookingManagement.findOneAndUpdate(
      { _id: id, sellerId },
      {
        $set: {
          customerRatingBySeller: rating,
          customerReviewBySeller: review,
        },
      },
      { new: true }
    );

    if (!booking) {
      return handleResponse(res, 404, 'Booking not found or unauthorized');
    }

    return handleResponse(res, 200, 'Customer review submitted successfully', booking);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// Get Seller Cancellation Policies
export const getSellerPolicies = async (req, res) => {
  try {
    const sellerId = req.user.id;
    const Seller = await import('../models/seller.js').then((m) => m.default);
    const seller = await Seller.findById(sellerId);
    if (!seller) {
      return handleResponse(res, 404, 'Seller not found');
    }
    return handleResponse(res, 200, 'Policies fetched', seller.cancellationPolicies || []);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// Update Seller Cancellation Policies
export const updateSellerPolicies = async (req, res) => {
  try {
    const sellerId = req.user.id;
    const { policies } = req.body;
    const Seller = await import('../models/seller.js').then((m) => m.default);

    const seller = await Seller.findByIdAndUpdate(
      sellerId,
      { $set: { cancellationPolicies: policies } },
      { new: true }
    );
    if (!seller) {
      return handleResponse(res, 404, 'Seller not found');
    }
    return handleResponse(res, 200, 'Cancellation policies updated successfully', seller.cancellationPolicies);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// Customer Cancel Booking with Auto-Refund calculation
export const cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await BookingManagement.findById(id);
    if (!booking) {
      return handleResponse(res, 404, 'Booking not found');
    }

    if (booking.bookingStatus === 'Cancelled') {
      return handleResponse(res, 400, 'Booking is already cancelled');
    }

    const Seller = await import('../models/seller.js').then((m) => m.default);
    const seller = await Seller.findById(booking.sellerId);

    const bookingTime = new Date(booking.bookingDate).getTime();
    const currentTime = Date.now();
    const diffHours = (bookingTime - currentTime) / (1000 * 60 * 60);

    let refundPercent = 0;
    if (seller && seller.cancellationPolicies) {
      const policy = seller.cancellationPolicies.find(
        (p) => String(p.categoryId) === String(booking.categoryId)
      );

      if (policy && policy.rules && policy.rules.length > 0) {
        const sortedRules = [...policy.rules].sort((a, b) => b.hoursBefore - a.hoursBefore);
        const matchedRule = sortedRules.find((rule) => diffHours >= rule.hoursBefore);
        if (matchedRule) {
          refundPercent = matchedRule.refundPercentage;
        }
      }
    }

    const refundAmount = Math.max(0, Number(booking.totalPaidAmount || 0) * (refundPercent / 100));

    booking.bookingStatus = 'Cancelled';
    booking.cancellationDate = new Date();
    booking.refundAmount = refundAmount;
    await booking.save();

    const io = req.app.get('io');
    if (io) {
      const payload = {
        bookingId: booking._id,
        customerName: booking.customerName,
        refundAmount,
        message: `Booking cancelled by ${booking.customerName}. Refund: ₹${refundAmount}`,
      };
      io.to(booking.sellerId.toString()).emit('bookingCancelledSellerAlert', payload);
      io.to('admin').emit('bookingCancelledAdminAlert', payload);
    }

    return handleResponse(res, 200, 'Booking cancelled successfully', {
      booking,
      refundAmount,
      refundPercent,
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// Customer: Get their own bookings by phone number
export const getCustomerBookings = async (req, res) => {
  try {
    const customer = req.user;
    const bookings = await BookingManagement.find({ mobileNumber: customer.phone }).sort({ bookingDate: -1 });
    return handleResponse(res, 200, 'Your bookings fetched successfully', bookings);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};
