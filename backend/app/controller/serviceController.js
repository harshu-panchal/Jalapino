import Service from "../models/service.js";
import ServiceEnrollment from "../models/serviceEnrollment.js";

// Seller creates a new service
export const createService = async (req, res) => {
    try {
        const sellerId = req.user.id;
        const serviceData = { ...req.body, sellerId };

        const newService = new Service(serviceData);
        await newService.save();

        res.status(201).json({ success: true, service: newService });
    } catch (error) {
        console.error("Create Service Error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// Seller gets their services
export const getSellerServices = async (req, res) => {
    try {
        const sellerId = req.user.id;
        const services = await Service.find({ sellerId }).sort({ createdAt: -1 });
        res.status(200).json({ success: true, services });
    } catch (error) {
        console.error("Get Seller Services Error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// Customer gets active live services
export const getActiveLiveServices = async (req, res) => {
    try {
        // Here we should ideally filter by seller.liveEnabled = true
        // and service.isActive = true, approvalStatus = 'approved'
        const services = await Service.find({ 
            isActive: true, 
            approvalStatus: 'approved' 
        }).populate('sellerId', 'shopName liveEnabled').lean();
        
        // Filter out services where seller's liveEnabled is false
        const filteredServices = services.filter(s => s.sellerId && s.sellerId.liveEnabled === true);

        res.status(200).json({ success: true, services: filteredServices });
    } catch (error) {
        console.error("Get Active Services Error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// Customer enrolls in a service
export const enrollService = async (req, res) => {
    try {
        const customerId = req.user.id;
        const { serviceId, subscriptionPlan } = req.body;

        const service = await Service.findById(serviceId);
        if (!service) {
            return res.status(404).json({ success: false, message: "Service not found" });
        }

        // Check if already enrolled
        const existingEnrollment = await ServiceEnrollment.findOne({ customerId, serviceId });
        if (existingEnrollment) {
            return res.status(400).json({ success: false, message: "Already enrolled in this service" });
        }

        const enrollmentData = {
            customerId,
            sellerId: service.sellerId,
            serviceId,
            subscriptionPlan,
            subscriptionStatus: "demo", // default starts as demo, can be updated later
            demoStartDate: new Date(),
            // Assuming 7 days demo by default
            demoEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        };

        const enrollment = new ServiceEnrollment(enrollmentData);
        await enrollment.save();

        res.status(201).json({ success: true, message: "Successfully enrolled in service", enrollment });
    } catch (error) {
        console.error("Enroll Service Error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// Customer gets their enrolled services
export const getCustomerEnrollments = async (req, res) => {
    try {
        const customerId = req.user.id;
        const enrollments = await ServiceEnrollment.find({ customerId })
            .populate('serviceId')
            .populate('sellerId', 'shopName')
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, enrollments });
    } catch (error) {
        console.error("Get Customer Enrollments Error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// Seller gets enrollments for their services
export const getSellerEnrollments = async (req, res) => {
    try {
        const sellerId = req.user.id;
        const enrollments = await ServiceEnrollment.find({ sellerId })
            .populate('serviceId', 'name description category')
            .populate('customerId', 'name email phone')
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, enrollments });
    } catch (error) {
        console.error("Get Seller Enrollments Error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
