import Seller from "../models/seller.js";
import logger from "../services/logger.js";
import { NOTIFICATION_ROLES, NOTIFICATION_EVENTS } from "../modules/notifications/notification.constants.js";
import { enqueueNotification } from "../modules/notifications/notification.queue.js";

const DEFAULT_DAYS_BEFORE_EXPIRY = 7;

/**
 * Returns the handler for the Document Expiry Notification job.
 */
export function getDocumentExpiryNotificationJobHandler() {
  return async () => {
    try {
      logger.info("Running Document Expiry Notification Job");
      
      const today = new Date();
      const targetExpiryDate = new Date();
      targetExpiryDate.setDate(today.getDate() + DEFAULT_DAYS_BEFORE_EXPIRY);
      
      // 1. Check Document Expiries
      const sellersWithExpiries = await Seller.find({
        $or: [
          { 'documentExpiries': { $exists: true, $not: { $size: 0 } } },
          { otherDocumentExpiryDate: { $exists: true, $ne: null } }
        ],
        isActive: true,
      });

      let sentCount = 0;

      for (const seller of sellersWithExpiries) {
        // Collect all expiry dates to check for this seller
        const expiriesToCheck = [];
        
        if (seller.otherDocumentExpiryDate) {
           expiriesToCheck.push({ key: 'otherDocument', date: new Date(seller.otherDocumentExpiryDate) });
        }
        
        if (seller.documentExpiries && seller.documentExpiries.size > 0) {
           for (const [key, date] of seller.documentExpiries.entries()) {
               expiriesToCheck.push({ key, date: new Date(date) });
           }
        }

        const msPerDay = 1000 * 60 * 60 * 24;

        for (const { key, date } of expiriesToCheck) {
            const daysUntilExpiry = Math.ceil((date - today) / msPerDay);

            // Only notify if expiring exactly on milestones or expired
            if (![30, 15, 7, 3, 1, 0, -1].includes(daysUntilExpiry) && daysUntilExpiry > 0) continue;

            const docName = key.replace(/([A-Z])/g, ' $1').trim().toUpperCase();

            let title, body;
            if (daysUntilExpiry <= 0) {
              title = `⚠️ ${docName} Expired`;
              body = `Your uploaded ${docName} has expired on ${date.toLocaleDateString('en-IN')}. Please renew and upload immediately.`;
            } else if (daysUntilExpiry === 1) {
              title = `🚨 ${docName} Expires Tomorrow!`;
              body = `Your uploaded ${docName} expires tomorrow (${date.toLocaleDateString('en-IN')}). Upload the renewed document now.`;
            } else {
              title = `⏰ ${docName} Expiring in ${daysUntilExpiry} Days`;
              body = `Your uploaded ${docName} will expire on ${date.toLocaleDateString('en-IN')}. Please renew it and upload soon.`;
            }

            // Send push notification directly via firebase service for testing foreground/background
            if (seller.fcmtoken || seller.fcmtokenMobile) {
               // Assuming sendPushNotification is imported from firebaseService
               await enqueueNotification({
                  userId: seller._id,
                  role: NOTIFICATION_ROLES.SELLER,
                  event: NOTIFICATION_EVENTS.DOCUMENT_EXPIRY_ALERT,
                  title,
                  body,
                  priority: "high",
                  channels: ["push"],
                  data: {
                    expiryDate: date.toISOString(),
                    daysUntilExpiry,
                    documentKey: key,
                    type: "document_expiry",
                  },
                });
            }
            sentCount++;
        }
      }
      
      // 2. Check GST Limits
      // Find all sellers without GST
      const sellersWithoutGst = await Seller.find({
          "documents.gstCertificate": { $exists: false },
          isActive: true
      });
      
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      
      const Transaction = (await import('../models/transaction.js')).default;
      
      for (const seller of sellersWithoutGst) {
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
          
          if (totalRevenue >= 1000000) {
              if (seller.fcmtoken || seller.fcmtokenMobile) {
                  await enqueueNotification({
                    userId: seller._id,
                    role: NOTIFICATION_ROLES.SELLER,
                    event: "GST_LIMIT_ALERT", // Dynamic event for GST
                    title: "Action Required: GST Registration",
                    body: "Your transaction volume has exceeded ₹10 Lakhs in the last 12 months. Please upload your GST Certificate.",
                    priority: "high",
                    channels: ["push"],
                    data: {
                      type: "gst_limit_reached",
                    },
                  });
              }
              sentCount++;
          }
      }

      logger.info(`Completed Document Expiry & GST Job. Sent ${sentCount} alerts.`);
    } catch (error) {
      logger.error("Error in Document Expiry Notification Job", { error: error.message });
    }
  };
}


/**
 * Returns the interval for the job in milliseconds.
 * Runs once a day (24 hours).
 */
export function getDocumentExpiryNotificationJobInterval() {
  return 24 * 60 * 60 * 1000;
}
