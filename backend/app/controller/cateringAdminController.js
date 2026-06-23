import handleResponse from "../utils/helper.js";
import CateringService from "../models/cateringService.js";
import CateringPackage from "../models/cateringPackage.js";
import CateringBooking from "../models/cateringBooking.js";
import Razorpay from "razorpay";
import crypto from "crypto";

// Services
export const createService = async (req, res) => {
    try {
        const service = await CateringService.create(req.body);
        return handleResponse(res, 201, "Service created successfully", service);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

export const getServices = async (req, res) => {
    try {
        const query = { deletedAt: null };
        if (req.query.status) query.status = req.query.status;
        
        const services = await CateringService.find(query).sort({ createdAt: -1 });
        return handleResponse(res, 200, "Services fetched", services);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

export const updateService = async (req, res) => {
    try {
        const service = await CateringService.findOneAndUpdate(
            { _id: req.params.id, deletedAt: null },
            req.body,
            { new: true }
        );
        if (!service) return handleResponse(res, 404, "Service not found");
        return handleResponse(res, 200, "Service updated", service);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

export const deleteService = async (req, res) => {
    try {
        const service = await CateringService.findOneAndUpdate(
            { _id: req.params.id, deletedAt: null },
            { deletedAt: new Date(), status: "inactive" },
            { new: true }
        );
        if (!service) return handleResponse(res, 404, "Service not found");
        return handleResponse(res, 200, "Service deleted");
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// Packages
export const createPackage = async (req, res) => {
    try {
        const pkg = await CateringPackage.create(req.body);
        return handleResponse(res, 201, "Package created successfully", pkg);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

export const getPackages = async (req, res) => {
    try {
        const query = { deletedAt: null };
        if (req.query.status) query.status = req.query.status;
        
        const packages = await CateringPackage.find(query).sort({ createdAt: -1 });
        return handleResponse(res, 200, "Packages fetched", packages);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

export const updatePackage = async (req, res) => {
    try {
        const pkg = await CateringPackage.findOneAndUpdate(
            { _id: req.params.id, deletedAt: null },
            req.body,
            { new: true }
        );
        if (!pkg) return handleResponse(res, 404, "Package not found");
        return handleResponse(res, 200, "Package updated", pkg);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

export const deletePackage = async (req, res) => {
    try {
        const pkg = await CateringPackage.findOneAndUpdate(
            { _id: req.params.id, deletedAt: null },
            { deletedAt: new Date(), status: "inactive" },
            { new: true }
        );
        if (!pkg) return handleResponse(res, 404, "Package not found");
        return handleResponse(res, 200, "Package deleted");
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// Bookings
export const getBookings = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const query = {};

        if (req.query.search) {
            query.$or = [
                { bookingId: { $regex: req.query.search, $options: "i" } },
                { customerName: { $regex: req.query.search, $options: "i" } },
                { mobileNumber: { $regex: req.query.search, $options: "i" } }
            ];
        }

        if (req.query.status && req.query.status !== "All") {
            query.status = req.query.status;
        }

        const skip = (page - 1) * limit;

        const bookings = await CateringBooking.find(query)
            .populate("serviceId", "name")
            .populate("packageId", "name price")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await CateringBooking.countDocuments(query);

        return handleResponse(res, 200, "Bookings fetched", {
            items: bookings,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

export const getBookingDetails = async (req, res) => {
    try {
        const booking = await CateringBooking.findById(req.params.id)
            .populate("serviceId")
            .populate("packageId");
        if (!booking) return handleResponse(res, 404, "Booking not found");
        return handleResponse(res, 200, "Booking details", booking);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

export const updateBookingStatus = async (req, res) => {
    try {
        const { status, note } = req.body;
        const booking = await CateringBooking.findById(req.params.id);
        if (!booking) return handleResponse(res, 404, "Booking not found");

        booking.status = status;
        booking.statusHistory.push({ status, note: note || `Status updated to ${status}` });
        
        await booking.save();
        
        return handleResponse(res, 200, "Booking status updated", booking);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

export const updatePaymentStatus = async (req, res) => {
    try {
        const { paidAmount } = req.body;
        const booking = await CateringBooking.findById(req.params.id);
        if (!booking) return handleResponse(res, 404, "Booking not found");

        booking.paidAmount = (booking.paidAmount || 0) + Number(paidAmount);
        
        await booking.save(); // middleware will handle paymentStatus
        
        return handleResponse(res, 200, "Payment updated", booking);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// Dashboard
export const getDashboardStats = async (req, res) => {
    try {
        const bookings = await CateringBooking.find();
        
        let totalRevenue = 0;
        let pendingBookings = 0;
        let confirmedBookings = 0;
        let completedBookings = 0;
        let cancelledBookings = 0;

        bookings.forEach(b => {
            if (b.status === "Pending") pendingBookings++;
            if (b.status === "Confirmed") confirmedBookings++;
            if (b.status === "Completed") completedBookings++;
            if (b.status === "Cancelled") cancelledBookings++;
            
            if (b.status !== "Cancelled") {
                totalRevenue += (b.paidAmount || 0);
            }
        });

        const upcomingEvents = await CateringBooking.find({
            status: { $in: ["Confirmed", "In Progress"] },
            eventDate: { $gte: new Date() }
        })
        .populate("serviceId", "name")
        .sort({ eventDate: 1 })
        .limit(5);

        return handleResponse(res, 200, "Dashboard stats", {
            totalBookings: bookings.length,
            pendingBookings,
            confirmedBookings,
            completedBookings,
            cancelledBookings,
            totalRevenue,
            upcomingEvents
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// Razorpay Payments
export const createRazorpayOrder = async (req, res) => {
    try {
        const { amount, bookingId } = req.body;
        if (!amount) return handleResponse(res, 400, "Amount is required");

        const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });

        const options = {
            amount: amount * 100, // Razorpay works in paise
            currency: "INR",
            receipt: `r_${bookingId.toString().slice(-6)}_${Date.now()}`
        };

        const order = await razorpay.orders.create(options);
        return handleResponse(res, 200, "Razorpay order created", order);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

export const verifyRazorpayPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount, bookingId } = req.body;

        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest("hex");

        if (expectedSignature === razorpay_signature) {
            // Payment is verified
            const booking = await CateringBooking.findById(bookingId);
            if (!booking) return handleResponse(res, 404, "Booking not found");

            booking.paidAmount = (booking.paidAmount || 0) + Number(amount);
            await booking.save();

            return handleResponse(res, 200, "Payment verified successfully", booking);
        } else {
            return handleResponse(res, 400, "Invalid payment signature");
        }
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};
