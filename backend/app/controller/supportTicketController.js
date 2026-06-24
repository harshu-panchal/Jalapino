import SupportTicket from '../models/system/SupportTicket.js';
import handleResponse from '../utils/helper.js';
import EventBooking from '../models/event/EventBooking.js';

// Create a new support ticket (Customer/Seller)
export const createTicket = async (req, res) => {
    try {
        const { category, priority, subject, description, relatedBookingId, attachments } = req.body;
        const userId = req.user?.id || req.user?.sellerId;
        const userType = req.user?.sellerId ? 'seller' : 'customer';

        let ticketData = {
            user: userId,
            userType,
            category,
            priority: priority || 'medium',
            subject,
            description,
            attachments
        };

        if (relatedBookingId) {
            const booking = await EventBooking.findById(relatedBookingId);
            if (booking) {
                ticketData.relatedBooking = booking._id;
            }
        }

        const ticket = await SupportTicket.create(ticketData);

        return handleResponse(res, 201, 'Support ticket created successfully', ticket);
    } catch (error) {
        console.error("Create ticket error:", error);
        return handleResponse(res, 500, 'Failed to create support ticket');
    }
};

// Get tickets for logged in user (Customer/Seller)
export const getMyTickets = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.sellerId;
        const tickets = await SupportTicket.find({ user: userId })
            .populate('relatedBooking', 'bookingId eventType eventDate overallStatus')
            .sort({ createdAt: -1 });

        return handleResponse(res, 200, 'Tickets fetched successfully', tickets);
    } catch (error) {
        return handleResponse(res, 500, 'Failed to fetch tickets');
    }
};

// Get all tickets (Admin)
export const getAllTickets = async (req, res) => {
    try {
        if (req.user.role !== 'admin') return handleResponse(res, 403, 'Unauthorized');

        const { status, priority, category } = req.query;
        let query = {};
        if (status) query.status = status;
        if (priority) query.priority = priority;
        if (category) query.category = category;

        const tickets = await SupportTicket.find(query)
            .populate('user', 'name email phone businessName')
            .populate('relatedBooking', 'bookingId eventType totalAmount overallStatus')
            .sort({ createdAt: -1 });

        return handleResponse(res, 200, 'Tickets fetched successfully', tickets);
    } catch (error) {
        return handleResponse(res, 500, 'Failed to fetch tickets');
    }
};

// Update ticket status (Admin)
export const updateTicketStatus = async (req, res) => {
    try {
        if (req.user.role !== 'admin') return handleResponse(res, 403, 'Unauthorized');

        const { id } = req.params;
        const { status, resolutionNotes } = req.body;

        const validStatuses = ['open', 'in_progress', 'waiting', 'resolved', 'closed'];
        if (status && !validStatuses.includes(status)) {
            return handleResponse(res, 400, 'Invalid status');
        }

        let updateData = {};
        if (status) updateData.status = status;
        if (resolutionNotes) updateData.resolutionNotes = resolutionNotes;

        const ticket = await SupportTicket.findByIdAndUpdate(id, updateData, { new: true });
        if (!ticket) return handleResponse(res, 404, 'Ticket not found');

        return handleResponse(res, 200, 'Ticket updated successfully', ticket);
    } catch (error) {
        return handleResponse(res, 500, 'Failed to update ticket');
    }
};
