import VenueVisitRequest from '../../models/event/VenueVisitRequest.js';
import SellerVenueAvailability from '../../models/event/SellerVenueAvailability.js';
import Product from '../../models/product.js';
import BookingManagement from '../../models/bookingManagement.js';
import Notification from '../../models/notification.js';
import handleResponse from '../../utils/helper.js';

// 1. Search Venues
export const searchVenues = async (req, res) => {
  try {
    const { state, city, guestCount } = req.query;
    const filter = { status: 'active' };

    if (state) filter.venueState = new RegExp(state, 'i');
    if (city) filter.venueCity = new RegExp(city, 'i');
    
    if (guestCount) {
      const count = Number(guestCount);
      filter.capacityMin = { $lte: count };
      filter.capacityMax = { $gte: count };
    }

    // Filter to products that have venueState or capacityMax defined (identifying them as venues)
    filter.$or = [
      { venueState: { $exists: true, $ne: '' } },
      { capacityMax: { $gt: 0 } }
    ];

    console.log('--- searchVenues endpoint hit ---');
    console.log('Incoming Query:', req.query);
    console.log('Constructed Filter:', JSON.stringify(filter));

    const venues = await Product.find(filter)
      .populate('sellerId', 'shopName name address ticketSystemEnabled addonDecorationEnabled addonDecorationPrice addonBridalEnabled addonBridalPrice addonCateringEnabled addonCateringPrice')
      .lean();

    console.log('Venues found count:', venues.length);

    return handleResponse(res, 200, 'Venues fetched successfully', venues);
  } catch (error) {
    console.error('searchVenues error:', error);
    return handleResponse(res, 500, error.message);
  }
};

// 2. Request Physical Visit
export const createVisitRequests = async (req, res) => {
  try {
    const customerId = req.user.id;
    // req.user might be authenticated under a Customer role
    const customerName = req.user.name || 'Customer';
    const { venueIds, preferredDate, preferredTimeSlot, guestCount, eventType, notes } = req.body;

    if (!Array.isArray(venueIds) || venueIds.length === 0) {
      return handleResponse(res, 400, 'Please select at least one venue.');
    }
    if (venueIds.length > 3) {
      return handleResponse(res, 400, 'You can request visits for up to 3 venues at a time.');
    }

    const createdRequests = [];

    for (const venueId of venueIds) {
      const venue = await Product.findById(venueId);
      if (!venue) continue;

      // Check slot availability and double-booking
      const availability = await SellerVenueAvailability.findOne({
        venueId,
        date: new Date(preferredDate)
      });

      if (availability && availability.bookedSlots.includes(preferredTimeSlot)) {
        return handleResponse(res, 400, `The slot ${preferredTimeSlot} on this date is already booked for ${venue.name}.`);
      }

      const visitRequest = await VenueVisitRequest.create({
        customerId,
        venueId,
        sellerId: venue.sellerId,
        preferredDate,
        preferredTimeSlot,
        guestCount,
        eventType,
        notes,
        status: 'Requested'
      });

      createdRequests.push(visitRequest);

      // Create Notification for the Seller
      await Notification.create({
        recipient: venue.sellerId,
        recipientModel: 'Seller',
        title: 'New Venue Physical Visit Requested',
        message: `Customer ${customerName} requested a physical visit for ${venue.name} on ${new Date(preferredDate).toDateString()} at ${preferredTimeSlot}.`,
        type: 'alert',
        data: { visitRequestId: visitRequest._id }
      }).catch(err => console.error('Seller notification failed', err));
    }

    return handleResponse(res, 201, 'Physical visit requests created successfully', createdRequests);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// 3. Get Customer Visit Requests
export const getCustomerVisitRequests = async (req, res) => {
  try {
    const customerId = req.user.id;
    const requests = await VenueVisitRequest.find({ customerId })
      .populate('venueId', 'name mainImage venueAddress venueCity venueState capacityMin capacityMax')
      .populate('sellerId', 'shopName phone')
      .sort({ createdAt: -1 });

    return handleResponse(res, 200, 'Visit requests fetched successfully', requests);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// 4. Get Seller Visit Requests
export const getSellerVisitRequests = async (req, res) => {
  try {
    const sellerId = req.user.id;
    const requests = await VenueVisitRequest.find({ sellerId })
      .populate('venueId', 'name mainImage venueAddress venueCity venueState capacityMin capacityMax')
      .populate('customerId', 'name phone email')
      .sort({ createdAt: -1 });

    return handleResponse(res, 200, 'Seller visit requests fetched successfully', requests);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// 5. Update Visit Request Status
export const updateVisitRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rescheduledDate, rescheduledTimeSlot, notes } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role; // 'seller' or 'customer'

    const visit = await VenueVisitRequest.findById(id).populate('venueId').populate('customerId');
    if (!visit) {
      return handleResponse(res, 404, 'Visit request not found');
    }

    // Authorization check
    if (userRole === 'seller' && visit.sellerId.toString() !== userId) {
      return handleResponse(res, 403, 'Unauthorized access');
    }
    if (userRole === 'customer' && visit.customerId._id.toString() !== userId) {
      return handleResponse(res, 403, 'Unauthorized access');
    }

    if (status === 'Rescheduled') {
      if (!rescheduledDate || !rescheduledTimeSlot) {
        return handleResponse(res, 400, 'Rescheduled date and time slot are required.');
      }

      // Check if selected date has existing bookings
      const GeneralBooking = await import('../../models/event/GeneralBooking.js').then(m => m.default);
      const targetDate = new Date(rescheduledDate);
      targetDate.setHours(0,0,0,0);

      const existingBookings = await GeneralBooking.find({
        venueId: visit.venueId._id,
        bookingDate: targetDate,
        bookingStatus: { $in: ['Confirmed', 'Pending'] }
      });

      // Allow rescheduling only if there is an existing booking on that date,
      // OR if the date is completely free (no bookings).
      // (This matches the calendar rescheduling rule requirement).
      const hasExistingBooking = existingBookings.length > 0;
      console.log(`Reschedule check: Date ${rescheduledDate} has existing bookings: ${hasExistingBooking}`);

      visit.status = 'Rescheduled';
      visit.rescheduledDetails = {
        date: rescheduledDate,
        timeSlot: rescheduledTimeSlot,
        proposedBy: userRole === 'seller' ? 'seller' : 'customer'
      };
    } else {
      visit.status = status;
      if (status === 'Confirmed') {
        // Block the slot in availability to prevent double booking
        const dateToBlock = visit.rescheduledDetails?.date || visit.preferredDate;
        const slotToBlock = visit.rescheduledDetails?.timeSlot || visit.preferredTimeSlot;

        await SellerVenueAvailability.findOneAndUpdate(
          { venueId: visit.venueId._id, date: new Date(dateToBlock) },
          { 
            $setOnInsert: { sellerId: visit.sellerId, timeSlots: [slotToBlock] },
            $addToSet: { bookedSlots: slotToBlock } 
          },
          { upsert: true, new: true }
        );
      } else if (status === 'Completed') {
        // Convert to CRM Lead (BookingManagement with Enquiry Only status)
        const dateOfLead = visit.rescheduledDetails?.date || visit.preferredDate;
        const timeSlotOfLead = visit.rescheduledDetails?.timeSlot || visit.preferredTimeSlot;

        await BookingManagement.create({
          sellerId: visit.sellerId,
          type: 'online',
          customerName: visit.customerId.name || 'Venue Lead',
          mobileNumber: visit.customerId.phone || '0000000000',
          bookingDate: dateOfLead,
          timeSlot: '4 Hours', // Default or map slot
          bookingStatus: 'Enquiry Only',
          guestsCount: visit.guestCount,
          remarks: `Converted from completed Physical Venue Visit for venue: ${visit.venueId.name}. Lead Source: Physical Venue Visit. Notes: ${notes || visit.notes || ''}`,
          categoryId: visit.venueId.categoryId
        });
      }
    }

    await visit.save();

    // Send Notification to opposite party
    const recipient = userRole === 'seller' ? visit.customerId._id : visit.sellerId;
    const recipientModel = userRole === 'seller' ? 'Customer' : 'Seller';
    const senderName = userRole === 'seller' ? 'Seller' : 'Customer';

    await Notification.create({
      recipient,
      recipientModel,
      title: `Visit Request ${status}`,
      message: `Your physical visit request status has been updated to "${status}" by ${senderName}.`,
      type: 'alert',
      data: { visitRequestId: visit._id }
    }).catch(err => console.error('Status change notification failed', err));

    return handleResponse(res, 200, `Visit request updated to ${status} successfully`, visit);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// 6. Manage Venue Availability Slots
export const getVenueAvailability = async (req, res) => {
  try {
    const { venueId, date } = req.query;
    const availability = await SellerVenueAvailability.findOne({
      venueId,
      date: new Date(date)
    });
    return handleResponse(res, 200, 'Availability fetched successfully', availability || { timeSlots: [], bookedSlots: [] });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const setVenueAvailability = async (req, res) => {
  try {
    const sellerId = req.user.id;
    const { venueId, date, timeSlots } = req.body;

    const availability = await SellerVenueAvailability.findOneAndUpdate(
      { sellerId, venueId, date: new Date(date) },
      { $set: { timeSlots } },
      { upsert: true, new: true }
    );

    return handleResponse(res, 200, 'Availability slots updated successfully', availability);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};
