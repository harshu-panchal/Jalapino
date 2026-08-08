import GeneralBooking from '../../models/event/GeneralBooking.js';
import MemberTicket from '../../models/event/MemberTicket.js';
import SellerVenueAvailability from '../../models/event/SellerVenueAvailability.js';
import Product from '../../models/product.js';
import Notification from '../../models/notification.js';
import handleResponse from '../../utils/helper.js';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { notify } from '../../modules/notifications/notification.service.js';
import { NOTIFICATION_EVENTS } from '../../modules/notifications/notification.constants.js';

// Helper to generate Unique Ticket ID and Secure QR Token
const generateTicketDetails = () => {
  const randomNum = Math.floor(100000 + Math.random() * 900000);
  const ticketId = `TKT-${randomNum}`;
  const secureQrToken = crypto.randomBytes(24).toString('hex');
  return { ticketId, secureQrToken };
};

// 1. Create General Booking
export const createBooking = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { 
      venueId, 
      bookingType, 
      bookingDate, 
      timeSlot, 
      members, 
      paymentMethod 
    } = req.body;

    if (!members || !Array.isArray(members) || members.length === 0) {
      return handleResponse(res, 400, 'Please add at least one member.');
    }

    const venue = await Product.findById(venueId);
    if (!venue) {
      return handleResponse(res, 404, 'Venue not found');
    }

    // 1. Validate Age Eligibility (e.g. Min Age: 10)
    // We can use a default of 5 if not configured on the venue
    const minAge = 5; 
    for (const m of members) {
      if (!m.name || !m.age || !m.gender || !m.mobileNumber) {
        return handleResponse(res, 400, 'All member details (Name, Age, Gender, Mobile) are required.');
      }
      if (Number(m.age) < minAge) {
        return handleResponse(res, 400, `Member ${m.name} is not eligible. Minimum age required is ${minAge} years.`);
      }
    }

    // 2. Validate Capacity Limit
    const targetDate = new Date(bookingDate);
    const availability = await SellerVenueAvailability.findOne({
      venueId,
      date: targetDate
    });

    const maxCap = venue.capacityMax || 50; // Default capacity limit
    const bookedCap = availability 
      ? availability.bookedSlots.filter(s => s === timeSlot).length * 10 // Mock booking count scale or actual count
      : 0;

    const remainingCap = maxCap - bookedCap;
    if (members.length > remainingCap) {
      return handleResponse(res, 400, `Selected time slot is full. Remaining capacity: ${remainingCap}`);
    }

    // 3. Calculate Total Price
    // Price can be per ticket/member or a flat venue booking fee. Let's charge per member.
    const pricePerMember = venue.price || 1000;
    
    // Add-ons calculation
    const Seller = await import('../../models/seller.js').then((m) => m.default);
    const seller = await Seller.findById(venue.sellerId);
    let addonsAmount = 0;
    const selectedAddons = req.body.addons || {};
    const addonDetails = [];

    if (selectedAddons.decoration && seller && seller.addonDecorationEnabled) {
      addonsAmount += seller.addonDecorationPrice || 0;
      addonDetails.push({ name: 'Decoration', price: seller.addonDecorationPrice || 0 });
    }
    if (selectedAddons.bridal && seller && seller.addonBridalEnabled) {
      addonsAmount += seller.addonBridalPrice || 0;
      addonDetails.push({ name: 'Bridal Room', price: seller.addonBridalPrice || 0 });
    }
    if (selectedAddons.catering && seller && seller.addonCateringEnabled) {
      addonsAmount += seller.addonCateringPrice || 0;
      addonDetails.push({ name: 'Catering', price: seller.addonCateringPrice || 0 });
    }

    const totalAmount = (pricePerMember * members.length) + addonsAmount;

    // 4. Create General Booking record
    const booking = await GeneralBooking.create({
      customerId,
      sellerId: venue.sellerId,
      venueId,
      bookingType,
      bookingDate,
      timeSlot,
      totalMembers: members.length,
      totalAmount,
      paymentMethod,
      paymentStatus: 'Pending',
      bookingStatus: 'Pending',
      addons: addonDetails
    });

    // 5. Payment Options Logic
    if (paymentMethod === 'Razorpay') {
      // Create Razorpay Order
      const razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_key',
        key_secret: process.env.RAZORPAY_KEY_SECRET || 'rzp_test_secret',
      });

      const options = {
        amount: totalAmount * 100, // Razorpay works in paise
        currency: 'INR',
        receipt: booking._id.toString(),
      };

      const order = await razorpay.orders.create(options);
      
      booking.razorpayOrderId = order.id;
      await booking.save();

      return handleResponse(res, 200, 'Razorpay order created', {
        bookingId: booking._id,
        razorpayOrderId: order.id,
        amount: totalAmount,
        keyId: process.env.RAZORPAY_KEY_ID
      });
    } else {
      // COD Flow: Confirm immediately
      booking.bookingStatus = 'Confirmed';
      booking.paymentStatus = 'Pending';
      await booking.save();

      // Generate Tickets & QR Codes for each member
      for (const m of members) {
        const { ticketId, secureQrToken } = generateTicketDetails();
        await MemberTicket.create({
          bookingId: booking._id,
          customerId,
          sellerId: venue.sellerId,
          venueId,
          memberName: m.name,
          category: Number(m.age) >= 18 ? 'Adult' : 'Child',
          gender: m.gender,
          age: Number(m.age),
          mobileNumber: m.mobileNumber,
          ticketId,
          secureQrToken,
          status: 'Confirmed'
        });
      }

      // Update slot availability booked count
      await SellerVenueAvailability.findOneAndUpdate(
        { venueId, date: targetDate },
        { 
          $setOnInsert: { sellerId: venue.sellerId, timeSlots: [timeSlot] },
          $addToSet: { bookedSlots: timeSlot } // Blocking slot
        },
        { upsert: true, new: true }
      );

      // In-app Notifications
      await Notification.create({
        recipient: venue.sellerId,
        recipientModel: 'Seller',
        title: 'New Event Booking (COD)',
        message: `New COD booking received from ${req.user.name || 'Customer'} for ${booking.totalMembers} members.`,
        type: 'alert',
        data: { bookingId: booking._id }
      }).catch(err => console.error('Seller notification failed', err));

      return handleResponse(res, 201, 'Booking confirmed successfully (COD)', booking);
    }
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// 2. Verify Razorpay Payment
export const verifyPayment = async (req, res) => {
  try {
    const { 
      bookingId, 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature,
      members 
    } = req.body;

    const booking = await GeneralBooking.findById(bookingId).populate('venueId');
    if (!booking) {
      return handleResponse(res, 404, 'Booking record not found');
    }

    // Verify signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'rzp_test_secret')
      .update(body.toString())
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      booking.paymentStatus = 'Failed';
      await booking.save();
      return handleResponse(res, 400, 'Payment verification failed');
    }

    // Confirm Booking
    booking.paymentStatus = 'Paid';
    booking.bookingStatus = 'Confirmed';
    booking.razorpayPaymentId = razorpay_payment_id;
    await booking.save();

    // Generate member tickets
    for (const m of members) {
      const { ticketId, secureQrToken } = generateTicketDetails();
      await MemberTicket.create({
        bookingId: booking._id,
        customerId: booking.customerId,
        sellerId: booking.sellerId,
        venueId: booking.venueId._id,
        memberName: m.name,
        category: Number(m.age) >= 18 ? 'Adult' : 'Child',
        gender: m.gender,
        age: Number(m.age),
        mobileNumber: m.mobileNumber,
        ticketId,
        secureQrToken,
        status: 'Confirmed'
      });
    }

    // Update availability
    await SellerVenueAvailability.findOneAndUpdate(
      { venueId: booking.venueId._id, date: booking.bookingDate },
      { 
        $setOnInsert: { sellerId: booking.sellerId, timeSlots: [booking.timeSlot] },
        $addToSet: { bookedSlots: booking.timeSlot }
      },
      { upsert: true, new: true }
    );

    // Notifications
    await Notification.create({
      recipient: booking.sellerId,
      recipientModel: 'Seller',
      title: 'Booking Confirmed (Paid)',
      message: `Catering/venue booking has been confirmed (paid online) for ${booking.totalMembers} members.`,
      type: 'alert',
      data: { bookingId: booking._id }
    }).catch(err => console.error('Seller notification failed', err));

    return handleResponse(res, 200, 'Payment verified and booking confirmed', booking);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// 3. Get My Tickets
export const getMyTickets = async (req, res) => {
  try {
    const customerId = req.user.id;
    const tickets = await MemberTicket.find({ customerId })
      .populate('venueId', 'name mainImage venueAddress venueCity venueState')
      .populate('sellerId', 'shopName')
      .sort({ createdAt: -1 });

    return handleResponse(res, 200, 'Tickets fetched successfully', tickets);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// 4. Seller QR Scan Ticket
export const scanTicket = async (req, res) => {
  try {
    const sellerId = req.user.id;
    const { secureQrToken, confirm } = req.body;

    const ticket = await MemberTicket.findOne({ secureQrToken })
      .populate('venueId')
      .populate('bookingId');
      
    if (!ticket) {
      return handleResponse(res, 404, 'Invalid Ticket / QR Code');
    }

    // Check ownership
    if (ticket.sellerId.toString() !== sellerId) {
      return handleResponse(res, 403, 'Unauthorized Ticket: This ticket belongs to another venue/seller.');
    }

    // Check status logic
    if (ticket.status === 'Checked-In') {
      return handleResponse(res, 400, 'Already Used / Already Scanned');
    }
    if (ticket.status === 'Cancelled') {
      return handleResponse(res, 400, 'Ticket Cancelled');
    }
    if (ticket.status === 'Invalid') {
      return handleResponse(res, 400, 'Invalid Ticket');
    }

    // If confirm is not true, we just return the validated details for seller preview
    if (!confirm) {
      return handleResponse(res, 200, 'Ticket Validated: Ready for Check-In', ticket);
    }

    // Accept & Check In
    ticket.status = 'Checked-In';
    ticket.scannedAt = new Date();
    await ticket.save();

    // Notify Customer of successful check in via Database Notification
    await Notification.create({
      recipient: ticket.customerId,
      recipientModel: 'Customer',
      title: 'Ticket Checked-In',
      message: `Your ticket for ${ticket.memberName} at ${ticket.venueId?.name || 'Venue'} was successfully scanned and checked-in.`,
      type: 'alert',
      data: { ticketId: ticket._id }
    }).catch(err => console.error('Customer DB notification failed', err));

    // Send real-time Firebase Push Notification to Customer
    await notify(NOTIFICATION_EVENTS.EVENT_CHECKED_IN, {
      userId: ticket.customerId,
      memberName: ticket.memberName,
      ticketId: ticket.ticketId,
      venueName: ticket.venueId?.name || 'Venue'
    }).catch(err => console.error('FCM customer notification failed', err));

    return handleResponse(res, 200, 'Valid Ticket: Checked-In Successfully', ticket);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// 5. Get Seller Bookings
export const getSellerGeneralBookings = async (req, res) => {
  try {
    const sellerId = req.user.id;
    const bookings = await GeneralBooking.find({ sellerId })
      .populate('venueId', 'name mainImage venueCity')
      .populate('customerId', 'name phone')
      .sort({ createdAt: -1 });

    return handleResponse(res, 200, 'Seller bookings fetched successfully', bookings);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// 6. Update Ticket Details
export const updateTicketDetails = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { id } = req.params;
    const { name, age, gender, mobileNumber } = req.body;

    const ticket = await MemberTicket.findById(id);
    if (!ticket) {
      return handleResponse(res, 404, 'Ticket not found');
    }

    if (ticket.customerId.toString() !== customerId) {
      return handleResponse(res, 403, 'Unauthorized to edit this ticket.');
    }

    if (['Checked-In', 'Completed', 'Cancelled'].includes(ticket.status)) {
      return handleResponse(res, 400, `Cannot edit ticket when status is ${ticket.status}`);
    }

    if (name) ticket.memberName = name;
    if (age) {
      ticket.age = Number(age);
      ticket.category = Number(age) >= 18 ? 'Adult' : 'Child';
    }
    if (gender) ticket.gender = gender;
    if (mobileNumber) ticket.mobileNumber = mobileNumber;

    await ticket.save();
    return handleResponse(res, 200, 'Ticket details updated successfully', ticket);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// 7. Cancel Ticket
export const cancelTicket = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { id } = req.params;

    const ticket = await MemberTicket.findById(id);
    if (!ticket) {
      return handleResponse(res, 404, 'Ticket not found');
    }

    if (ticket.customerId.toString() !== customerId) {
      return handleResponse(res, 403, 'Unauthorized to cancel this ticket.');
    }

    if (['Checked-In', 'Completed', 'Cancelled'].includes(ticket.status)) {
      return handleResponse(res, 400, `Ticket is already ${ticket.status}`);
    }

    ticket.status = 'Cancelled';
    await ticket.save();

    // Deduct member count and price from the main booking
    const booking = await GeneralBooking.findById(ticket.bookingId).populate('venueId');
    if (booking) {
      const pricePerMember = booking.venueId?.price || 1000;
      booking.totalMembers = Math.max(0, booking.totalMembers - 1);
      booking.totalAmount = Math.max(0, booking.totalAmount - pricePerMember);
      if (booking.totalMembers === 0) {
        booking.bookingStatus = 'Cancelled';
      }
      await booking.save();
    }

    return handleResponse(res, 200, 'Ticket cancelled successfully', ticket);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// 8. Complete Add-on Service (Seller side)
export const completeAddonService = async (req, res) => {
  try {
    const sellerId = req.user.id;
    const { bookingId, addonId } = req.params;

    const booking = await GeneralBooking.findOne({ _id: bookingId, sellerId }).populate('venueId');
    if (!booking) {
      return handleResponse(res, 404, 'Booking not found or not authorized for this seller.');
    }

    const addon = booking.addons.id(addonId);
    if (!addon) {
      return handleResponse(res, 404, 'Add-on service not found.');
    }

    if (addon.status === 'Completed') {
      return handleResponse(res, 400, 'Add-on service is already marked as completed.');
    }

    addon.status = 'Completed';
    await booking.save();

    // Trigger customer real-time FCM notification
    try {
      await notify(
        booking.customerId.toString(),
        'ADDON_COMPLETED',
        {
          userId: booking.customerId.toString(),
          addonName: addon.name,
          bookingId: booking.bookingId || 'COD-Booking',
          venueName: booking.venueId?.name || 'Venue'
        }
      );
    } catch (fcmError) {
      console.error('Failed to send push notification:', fcmError);
    }

    return handleResponse(res, 200, `${addon.name} service completed successfully.`, booking);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// 9. Review/Rate Add-on Service (Customer side)
export const reviewAddonService = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { bookingId, addonId } = req.params;
    const { rating, review } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return handleResponse(res, 400, 'Please provide a valid rating between 1 and 5.');
    }

    const booking = await GeneralBooking.findOne({ _id: bookingId, customerId });
    if (!booking) {
      return handleResponse(res, 404, 'Booking not found.');
    }

    const addon = booking.addons.id(addonId);
    if (!addon) {
      return handleResponse(res, 404, 'Add-on service not found.');
    }

    if (addon.status !== 'Completed') {
      return handleResponse(res, 400, 'You can only review an add-on service after it has been completed by the seller.');
    }

    addon.rating = Number(rating);
    addon.review = review || "";
    await booking.save();

    return handleResponse(res, 200, 'Review submitted successfully.', booking);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};
