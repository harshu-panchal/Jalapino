import handleResponse from '../utils/helper.js';
import AdvanceBooking from '../models/advanceBooking.js';
import Notification from '../models/notification.js'; // Assumed notification model for socket/push

// Seller fetches their advance bookings
export const getSellerAdvanceBookings = async (req, res) => {
  try {
    const sellerId = req.user.id;
    const { status, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const query = { sellerId };
    if (status && status !== 'all') {
      query.bookingStatus = status;
    }

    const bookings = await AdvanceBooking.find(query)
      .populate('customerId', 'name phone email')
      .populate('productId', 'name images')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await AdvanceBooking.countDocuments(query);

    return handleResponse(res, 200, 'Advance bookings fetched successfully', {
      bookings,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// Seller accepts booking
export const acceptAdvanceBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await AdvanceBooking.findOneAndUpdate(
      { _id: id, sellerId: req.user.id },
      { bookingStatus: 'accepted' },
      { new: true }
    );

    if (!booking) {
      return handleResponse(res, 404, 'Booking not found');
    }

    return handleResponse(res, 200, 'Booking accepted successfully', booking);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// Seller marks decoration complete
export const completeDecoration = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await AdvanceBooking.findOneAndUpdate(
      { _id: id, sellerId: req.user.id },
      { bookingStatus: 'decoration_complete' },
      { new: true }
    ).populate('customerId');

    if (!booking) {
      return handleResponse(res, 404, 'Booking not found');
    }

    // Emit real-time notification to customer using io from app
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${booking.customerId._id.toString()}`).emit('booking_decoration_complete', {
        title: 'Decoration Complete!',
        body: 'Your advance booking decoration is ready for confirmation.',
        bookingId: booking._id,
      });
    }

    return handleResponse(res, 200, 'Decoration marked as complete', booking);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// Customer fetches their advance bookings
export const getCustomerAdvanceBookings = async (req, res) => {
  try {
    const customerId = req.user.id;
    const bookings = await AdvanceBooking.find({ customerId })
      .populate('sellerId', 'shopName name')
      .populate('productId', 'name images')
      .sort({ createdAt: -1 });

    return handleResponse(res, 200, 'Customer advance bookings fetched', bookings);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// Customer confirms final booking
export const customerConfirmBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await AdvanceBooking.findOneAndUpdate(
      { _id: id, customerId: req.user.id, bookingStatus: 'decoration_complete' },
      { bookingStatus: 'customer_confirmed' },
      { new: true }
    );

    if (!booking) {
      return handleResponse(res, 404, 'Booking not found or not ready for confirmation');
    }

    return handleResponse(res, 200, 'Booking confirmed by customer', booking);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// Create a new advance booking (customer side)
export const createAdvanceBooking = async (req, res) => {
  try {
    const {
      sellerId,
      productId,
      productCode,
      deliveryDate,
      totalAmount,
      advanceAmountPaid,
      specialInstructions,
    } = req.body;

    const booking = new AdvanceBooking({
      customerId: req.user.id,
      sellerId,
      productId,
      productCode,
      deliveryDate,
      totalAmount,
      advanceAmountPaid,
      specialInstructions,
    });

    await booking.save();

    return handleResponse(res, 201, 'Advance booking created successfully', booking);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};
