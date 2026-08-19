import VideoSubscriptionPlan from "../../models/videoSubscriptionPlan.js";
import SellerSubscription from "../../models/sellerSubscription.js";
import Seller from "../../models/seller.js";

// Create a new subscription plan
export const createPlan = async (req, res) => {
    try {
        const { name, description, monthlyPrice, quarterlyPrice, yearlyPrice, includedStorageMB, extraMBPrice, isActive } = req.body;

        const newPlan = new VideoSubscriptionPlan({
            name,
            description,
            monthlyPrice: monthlyPrice || 0,
            quarterlyPrice: quarterlyPrice || 0,
            yearlyPrice: yearlyPrice || 0,
            includedStorageMB,
            extraMBPrice,
            isActive: isActive !== undefined ? isActive : true,
        });

        await newPlan.save();
        res.status(201).json({ success: true, message: "Plan created successfully", plan: newPlan });
    } catch (error) {
        console.error("Create Plan Error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// Get all subscription plans
export const getPlans = async (req, res) => {
    try {
        const plans = await VideoSubscriptionPlan.find().sort({ createdAt: -1 });
        res.status(200).json({ success: true, plans });
    } catch (error) {
        console.error("Get Plans Error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// Get all seller subscriptions (for admin dashboard)
export const getSubscriptions = async (req, res) => {
    try {
        const subscriptions = await SellerSubscription.find()
            .populate("sellerId", "name shopName email")
            .populate("planId", "name")
            .sort({ createdAt: -1 });
        res.status(200).json({ success: true, subscriptions });
    } catch (error) {
        console.error("Get Subscriptions Error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// Confirm COD payment and activate subscription
export const confirmCODSubscription = async (req, res) => {
    try {
        const { id } = req.params;
        const subscription = await SellerSubscription.findById(id);
        if (!subscription) return res.status(404).json({ success: false, message: "Subscription not found" });
        if (subscription.paymentMethod !== "COD") return res.status(400).json({ success: false, message: "Not a COD subscription" });

        subscription.paymentStatus = "paid";
        subscription.isActive = true;
        await subscription.save();

        // Activate on seller
        await Seller.findByIdAndUpdate(subscription.sellerId, {
            activeVideoSubscriptionId: subscription._id,
        });

        res.status(200).json({ success: true, message: "Subscription activated successfully" });
    } catch (error) {
        console.error("Confirm COD Error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// Update an existing plan
export const updatePlan = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const updatedPlan = await VideoSubscriptionPlan.findByIdAndUpdate(id, updates, { new: true });
        if (!updatedPlan) return res.status(404).json({ success: false, message: "Plan not found" });
        res.status(200).json({ success: true, message: "Plan updated successfully", plan: updatedPlan });
    } catch (error) {
        console.error("Update Plan Error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// Delete a plan
export const deletePlan = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedPlan = await VideoSubscriptionPlan.findByIdAndDelete(id);
        if (!deletedPlan) return res.status(404).json({ success: false, message: "Plan not found" });
        res.status(200).json({ success: true, message: "Plan deleted successfully" });
    } catch (error) {
        console.error("Delete Plan Error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

