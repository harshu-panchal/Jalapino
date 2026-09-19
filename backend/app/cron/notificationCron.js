import cron from "node-cron";
import Seller from "../models/seller.js";
import Transaction from "../models/transaction.js";
import { sendPushNotification } from "../services/firebaseService.js";

const runDailyNotificationChecks = async () => {
    try {
        console.log("[CRON] Starting Daily Notification Checks...");
        const sellers = await Seller.find({ isActive: true, fcmTokens: { $exists: true, $not: { $size: 0 } } });

        const now = new Date();
        const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        
        // Date 12 months ago
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

        for (const seller of sellers) {
            // 1. Check Document Expiries
            if (seller.documentExpiries && seller.documentExpiries.size > 0) {
                for (const [key, expiryDate] of seller.documentExpiries.entries()) {
                    const expiry = new Date(expiryDate);
                    const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    
                    if (daysLeft === 30 || daysLeft === 15 || daysLeft === 3 || daysLeft === 1 || daysLeft <= 0) {
                        const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                        const title = daysLeft > 0 ? "Document Expiring Soon!" : "Document Expired!";
                        const body = `Your ${label} ${daysLeft > 0 ? `expires in ${daysLeft} days` : 'has expired'}. Please reupload to avoid account suspension.`;
                        
                        await sendPushNotification(seller.fcmTokens, title, body, { type: 'DOCUMENT_EXPIRY', documentKey: key });
                        console.log(`[CRON] Sent Expiry Notification to ${seller.name} for ${key}`);
                    }
                }
            }

            // 2. Check GST Limit (10 Lakhs in 12 months)
            // If they don't have a GST certificate uploaded/approved
            const hasGst = seller.documents && seller.documents.gstCertificate;
            if (!hasGst) {
                const transactions = await Transaction.aggregate([
                    {
                        $match: {
                            user: seller._id,
                            userModel: "Seller",
                            status: "Settled",
                            createdAt: { $gte: twelveMonthsAgo }
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            totalAmount: { $sum: "$amount" }
                        }
                    }
                ]);

                const totalRevenue = transactions.length > 0 ? transactions[0].totalAmount : 0;
                
                // 10 Lakhs = 1,000,000
                if (totalRevenue >= 1000000) {
                    await sendPushNotification(
                        seller.fcmTokens, 
                        "Action Required: GST Registration", 
                        "Your transaction volume has exceeded ₹10 Lakhs in the last 12 months. Please upload your GST Certificate.", 
                        { type: 'GST_LIMIT_REACHED' }
                    );
                    console.log(`[CRON] Sent GST Alert to ${seller.name} (Revenue: ${totalRevenue})`);
                }
            }
        }
        
        console.log("[CRON] Daily Notification Checks Completed.");
    } catch (err) {
        console.error("[CRON] Error running daily notification checks:", err);
    }
};

// Run everyday at 10:00 AM
export const initNotificationCron = () => {
    cron.schedule("0 10 * * *", () => {
        runDailyNotificationChecks();
    });
    console.log("[CRON] Notification Cron Initialized.");
};
