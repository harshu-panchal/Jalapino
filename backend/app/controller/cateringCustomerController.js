import handleResponse from "../utils/helper.js";
import CateringService from "../models/cateringService.js";
import CateringPackage from "../models/cateringPackage.js";
import CateringBooking from "../models/cateringBooking.js";
import Notification from "../models/notification.js";

export const getActiveServices = async (req, res) => {
    try {
        const services = await CateringService.find({ status: "active", deletedAt: null }).sort({ basePrice: 1 });
        return handleResponse(res, 200, "Active services fetched", services);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

export const getActivePackages = async (req, res) => {
    try {
        const packages = await CateringPackage.find({ status: "active", deletedAt: null }).sort({ price: 1 });
        return handleResponse(res, 200, "Active packages fetched", packages);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

export const submitBooking = async (req, res) => {
    try {
        const {
            customerName, mobileNumber, email, eventDate, eventTime,
            eventAddress, numberOfGuests, serviceId, packageId, specialInstructions
        } = req.body;

        if (!customerName || !mobileNumber || !eventDate || !eventAddress || !numberOfGuests) {
            return handleResponse(res, 400, "Missing required booking details");
        }

        let packageAmount = 0;

        if (packageId) {
            const pkg = await CateringPackage.findById(packageId);
            if (pkg) packageAmount = pkg.price;
        } else if (serviceId) {
            const srv = await CateringService.findById(serviceId);
            if (srv) packageAmount = srv.basePrice;
        }

        const newBooking = await CateringBooking.create({
            customerName, mobileNumber, email, eventDate, eventTime,
            eventAddress, numberOfGuests, serviceId, packageId, specialInstructions,
            packageAmount, pendingAmount: packageAmount,
            status: "Pending", paymentStatus: "Pending"
        });

        // Notify Admin
        await Notification.create({
            title: "New Catering Booking",
            message: `New booking request from ${customerName} for ${new Date(eventDate).toDateString()}.`,
            type: "catering",
            metadata: { bookingId: newBooking._id }
        }).catch(err => console.error("Notification creation failed", err));

        return handleResponse(res, 201, "Booking submitted successfully", newBooking);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};
