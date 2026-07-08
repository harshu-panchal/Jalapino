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
      
      // Find ALL active sellers with a document expiry date set
      const sellers = await Seller.find({
        otherDocumentExpiryDate: { $exists: true, $ne: null },
        isActive: true,
      });

      let sentCount = 0;

      for (const seller of sellers) {
        const expiryDate = new Date(seller.otherDocumentExpiryDate);
        const msPerDay = 1000 * 60 * 60 * 24;
        const daysUntilExpiry = Math.ceil((expiryDate - today) / msPerDay);

        // Only notify if expiring within 7 days or already expired
        if (daysUntilExpiry > DEFAULT_DAYS_BEFORE_EXPIRY) continue;

        // Prevent duplicate notification within 24 hours
        if (seller.lastExpiryNotificationSentAt) {
          const hoursSinceLast = (new Date() - seller.lastExpiryNotificationSentAt) / (1000 * 60 * 60);
          if (hoursSinceLast < 24) continue;
        }

        // Build notification message based on days left
        let title, body;
        if (daysUntilExpiry <= 0) {
          title = "⚠️ Document Expired";
          body = `Your uploaded certificate has expired on ${expiryDate.toLocaleDateString('en-IN')}. Please renew and upload immediately to avoid service disruption.`;
        } else if (daysUntilExpiry === 1) {
          title = "🚨 Certificate Expires Tomorrow!";
          body = `Your uploaded certificate expires tomorrow (${expiryDate.toLocaleDateString('en-IN')}). Upload the renewed document now.`;
        } else {
          title = `⏰ Certificate Expiring in ${daysUntilExpiry} Days`;
          body = `Your uploaded certificate will expire on ${expiryDate.toLocaleDateString('en-IN')}. Please renew it and upload the updated document soon.`;
        }

        // Send push notification if FCM token exists
        if (seller.fcmtoken || seller.fcmtokenMobile) {
          await enqueueNotification({
            userId: seller._id,
            role: NOTIFICATION_ROLES.SELLER,
            event: NOTIFICATION_EVENTS.DOCUMENT_EXPIRY_ALERT,
            title,
            body,
            priority: "high",
            channels: ["push"],
            data: {
              expiryDate: expiryDate.toISOString(),
              daysUntilExpiry,
              type: "document_expiry",
            },
          });
        }
        
        // Update last notified time
        seller.lastExpiryNotificationSentAt = new Date();
        await seller.save();
        sentCount++;
      }
      
      logger.info(`Completed Document Expiry Notification Job. Notified ${sentCount} sellers.`);
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
