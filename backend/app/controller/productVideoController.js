import Seller from "../models/seller.js";
import Product from "../models/product.js";
import VideoSubscriptionPlan from "../models/videoSubscriptionPlan.js";
import SellerSubscription from "../models/sellerSubscription.js";
import Razorpay from "razorpay";
import crypto from "crypto";
import fs from "fs";

const getRazorpay = () => new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Helper: get price for billing cycle
const getPriceForCycle = (plan, billingCycle) => {
    if (billingCycle === "quarterly") return plan.quarterlyPrice;
    if (billingCycle === "yearly") return plan.yearlyPrice;
    return plan.monthlyPrice;
};

// Helper: get validity days for billing cycle
const getValidityDays = (billingCycle) => {
    if (billingCycle === "quarterly") return 90;
    if (billingCycle === "yearly") return 365;
    return 30;
};

// ─── GET ACTIVE PLANS (DB dynamic) ────────────────────────────────────────────
export const getActivePlans = async (req, res) => {
    try {
        const plans = await VideoSubscriptionPlan.find({ isActive: true }).sort({ monthlyPrice: 1 });
        const sellerId = req.user.id;
        const seller = await Seller.findById(sellerId);

        let activeSubscription = null;
        if (seller?.activeVideoSubscriptionId) {
            activeSubscription = await SellerSubscription.findById(seller.activeVideoSubscriptionId)
                .populate("planId");
        }

        res.status(200).json({
            success: true,
            plans,
            sellerSubscription: activeSubscription,
            usedVideoStorageMB: seller?.usedVideoStorageMB || 0
        });
    } catch (error) {
        console.error("Get Active Plans Error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ─── CREATE RAZORPAY ORDER FOR SUBSCRIPTION ───────────────────────────────────
export const createSubscriptionOrder = async (req, res) => {
    try {
        const { planId, billingCycle } = req.body;
        const plan = await VideoSubscriptionPlan.findById(planId);
        if (!plan || !plan.isActive) {
            return res.status(404).json({ success: false, message: "Plan not found or inactive" });
        }

        const amount = getPriceForCycle(plan, billingCycle);
        if (amount <= 0) {
            return res.status(200).json({ success: true, isFree: true, amount: 0 });
        }

        const razorpay = getRazorpay();
        const order = await razorpay.orders.create({
            amount: Math.round(amount * 100),
            currency: "INR",
            receipt: `vsub_${req.user.id.slice(-6)}_${Date.now()}`
        });

        res.status(200).json({ success: true, isFree: false, order, amount });
    } catch (error) {
        console.error("Create Subscription Order Error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ─── SUBSCRIBE TO PLAN (COD or Razorpay verified) ─────────────────────────────
export const subscribeToPlan = async (req, res) => {
    try {
        const { planId, billingCycle, paymentMethod, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        const sellerId = req.user.id;

        const plan = await VideoSubscriptionPlan.findById(planId);
        if (!plan || !plan.isActive) {
            return res.status(404).json({ success: false, message: "Plan not found or inactive" });
        }

        const amount = getPriceForCycle(plan, billingCycle);
        const validityDays = getValidityDays(billingCycle);
        const startDate = new Date();
        const expiryDate = new Date();
        expiryDate.setDate(startDate.getDate() + validityDays);

        let paymentStatus = "pending_cod";
        let verifiedRazorpayPaymentId = null;

        if (paymentMethod === "Razorpay" && amount > 0) {
            // Verify Razorpay signature
            const body = razorpay_order_id + "|" + razorpay_payment_id;
            const expectedSignature = crypto
                .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
                .update(body)
                .digest("hex");

            if (expectedSignature !== razorpay_signature) {
                return res.status(400).json({ success: false, message: "Invalid payment signature" });
            }
            paymentStatus = "paid";
            verifiedRazorpayPaymentId = razorpay_payment_id;
        } else if (paymentMethod === "COD") {
            paymentStatus = "pending_cod";
        } else if (amount === 0) {
            paymentStatus = "paid";
        }

        // Deactivate previous subscriptions
        await SellerSubscription.updateMany({ sellerId, isActive: true }, { isActive: false });

        const subscription = new SellerSubscription({
            sellerId,
            planId: plan._id,
            billingCycle,
            amountPaid: amount,
            paymentMethod: paymentMethod || "Razorpay",
            paymentStatus,
            razorpayOrderId: razorpay_order_id || null,
            razorpayPaymentId: verifiedRazorpayPaymentId,
            startDate,
            expiryDate,
            includedStorageMB: plan.includedStorageMB,
            isActive: paymentStatus === "paid",
        });
        await subscription.save();

        // Update Seller only if paid
        if (paymentStatus === "paid") {
            await Seller.findByIdAndUpdate(sellerId, {
                activeVideoSubscriptionId: subscription._id,
            });
        }

        res.status(200).json({
            success: true,
            message: paymentMethod === "COD"
                ? "COD subscription request submitted. Admin will activate after payment collection."
                : "Successfully subscribed to plan!",
            subscription,
            requiresAdminConfirmation: paymentMethod === "COD",
        });
    } catch (error) {
        console.error("Subscribe to Plan Error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ─── CHECK VIDEO UPLOAD INTENT ─────────────────────────────────────────────────
export const checkVideoUploadIntent = async (req, res) => {
    try {
        const { fileSizeMB } = req.body;
        const sellerId = req.user.id;

        const seller = await Seller.findById(sellerId);
        if (!seller) return res.status(404).json({ success: false, message: "Seller not found" });

        const usedMB = seller.usedVideoStorageMB || 0;
        const requiredMB = parseFloat(fileSizeMB);

        let includedMB = 0;
        let extraMBPrice = 5;

        if (seller.activeVideoSubscriptionId) {
            const sub = await SellerSubscription.findById(seller.activeVideoSubscriptionId).populate("planId");
            if (sub?.planId) {
                includedMB = sub.planId.includedStorageMB;
                extraMBPrice = sub.planId.extraMBPrice;
            }
        }

        const newTotalMB = usedMB + requiredMB;

        if (newTotalMB <= includedMB) {
            return res.status(200).json({ success: true, requiresPayment: false, message: "Within storage limit." });
        }

        const mbToCharge = usedMB >= includedMB ? requiredMB : (newTotalMB - includedMB);
        const totalAmount = Math.ceil(mbToCharge * extraMBPrice);

        // Create Razorpay order for extra storage
        const razorpay = getRazorpay();
        const order = await razorpay.orders.create({
            amount: Math.round(totalAmount * 100),
            currency: "INR",
            receipt: `vext_${sellerId.slice(-6)}_${Date.now()}`
        });

        return res.status(200).json({
            success: true,
            requiresPayment: true,
            totalAmount,
            mbToCharge,
            extraMBPrice,
            razorpayOrder: order,
            message: "Storage limit exceeded. Payment required.",
        });
    } catch (error) {
        console.error("Check Video Upload Intent Error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ─── UPLOAD PRODUCT VIDEO (after payment verified) ────────────────────────────
export const uploadProductVideo = async (req, res) => {
    try {
        const { productId, paymentMethod, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        const sellerId = req.user.id;
        const file = req.file;

        if (!file) return res.status(400).json({ success: false, message: "No video file provided" });

        const seller = await Seller.findById(sellerId);
        if (!seller) {
            if (file) fs.unlinkSync(file.path);
            return res.status(404).json({ success: false, message: "Seller not found" });
        }

        let product = null;
        if (productId) {
            product = await Product.findOne({ _id: productId, sellerId });
            if (!product) {
                fs.unlinkSync(file.path);
                return res.status(404).json({ success: false, message: "Product not found" });
            }
        }

        const fileSizeMB = file.size / (1024 * 1024);
        const usedMB = seller.usedVideoStorageMB || 0;

        let includedMB = 0;
        let extraMBPrice = 5;
        if (seller.activeVideoSubscriptionId) {
            const sub = await SellerSubscription.findById(seller.activeVideoSubscriptionId).populate("planId");
            if (sub?.planId) {
                includedMB = sub.planId.includedStorageMB;
                extraMBPrice = sub.planId.extraMBPrice;
            }
        }

        const newTotalMB = usedMB + fileSizeMB;
        const requiresPayment = newTotalMB > includedMB;

        if (requiresPayment) {
            if (paymentMethod === "Razorpay") {
                // Verify Razorpay signature
                const body = razorpay_order_id + "|" + razorpay_payment_id;
                const expectedSignature = crypto
                    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
                    .update(body)
                    .digest("hex");
                if (expectedSignature !== razorpay_signature) {
                    fs.unlinkSync(file.path);
                    return res.status(400).json({ success: false, message: "Invalid payment signature" });
                }
            } else if (paymentMethod === "COD") {
                // COD for extra storage: allow upload, mark as pending collection
                // Admin will see this in their dashboard
            } else {
                fs.unlinkSync(file.path);
                return res.status(402).json({ success: false, message: "Payment required for extra storage" });
            }
        }

        const videoUrl = `/uploads/videos/${file.filename}`;
        if (product) {
            if (!product.videos) product.videos = [];
            product.videos.push({ url: videoUrl, sizeMB: parseFloat(fileSizeMB.toFixed(2)) });
            if (!product.videoUrl) product.videoUrl = videoUrl;
            await product.save();
        }

        seller.usedVideoStorageMB = parseFloat(newTotalMB.toFixed(2));
        await seller.save();

        res.status(200).json({
            success: true,
            message: "Video uploaded successfully",
            videoUrl,
            videos: product ? product.videos : [],
            usedStorage: seller.usedVideoStorageMB,
        });
    } catch (error) {
        console.error("Upload Product Video Error:", error);
        if (req.file) fs.unlinkSync(req.file.path);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

