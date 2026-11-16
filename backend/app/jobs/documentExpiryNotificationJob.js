import Seller from "../models/seller.js";
import logger from "../services/logger.js";
import { NOTIFICATION_ROLES, NOTIFICATION_EVENTS } from "../modules/notifications/notification.constants.js";
import { enqueueNotification } from "../modules/notifications/notification.queue.js";
import { emitSellerNotification } from "../modules/notifications/notification.service.js";
import Notification from "../models/notification.js";

const DEFAULT_DAYS_BEFORE_EXPIRY = 7;

// ₹10 lakh in the last 12 months -> GST certificate needed.
export const GST_TURNOVER_LIMIT = 1000000;
const GST_REMINDER_EVERY_DAYS = 7;

export const hasGstCertificate = (seller) => Boolean(String(seller?.documents?.gstCertificate || '').trim());

/**
 * Seller's sales in the last 12 months, from the DB:
 * - retail orders that were delivered (product value)
 * - event bookings: money actually received (cancelled bookings not counted)
 */
export async function getSellerTwelveMonthTurnover(sellerId) {
  const mongoose = (await import('mongoose')).default;
  const Order = (await import('../models/order.js')).default;
  const EventBooking = (await import('../models/event/EventBooking.js')).default;
  const id = new mongoose.Types.ObjectId(String(sellerId));
  const since = new Date();
  since.setMonth(since.getMonth() - 12);

  const [retail] = await Order.aggregate([
    {
      $match: {
        seller: id,
        $and: [
          { $or: [{ workflowStatus: 'DELIVERED' }, { status: 'delivered' }] },
          { $or: [{ deliveredAt: { $gte: since } }, { deliveredAt: null, createdAt: { $gte: since } }] },
        ],
      },
    },
    {
      $group: {
        _id: null,
        total: {
          $sum: {
            $cond: [
              { $gt: ['$paymentBreakdown.productSubtotal', 0] },
              '$paymentBreakdown.productSubtotal',
              { $ifNull: ['$pricing.subtotal', 0] },
            ],
          },
        },
      },
    },
  ]);

  const [events] = await EventBooking.aggregate([
    {
      $match: {
        'services.seller': id,
        overallStatus: { $ne: 'CANCELLED' },
        amountPaid: { $gt: 0 },
        createdAt: { $gte: since },
      },
    },
    { $group: { _id: null, total: { $sum: '$amountPaid' } } },
  ]);

  return Math.round(((retail?.total || 0) + (events?.total || 0)) * 100) / 100;
}

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
            let needsSave = false;
            
            if (daysUntilExpiry <= 0) {
              title = `⚠️ ${docName} Expired`;
              body = `Your uploaded ${docName} has expired on ${date.toLocaleDateString('en-IN')}. Please renew and upload immediately.`;
              
              if (!seller.documentStatuses) {
                seller.documentStatuses = new Map();
              }
              seller.documentStatuses.set(key, 'pending_reupload');
              needsSave = true;
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
            
            if (needsSave) {
              await seller.save();
            }
            sentCount++;
        }
      }
      
      // 2. Check GST Limits: sales in last 12 months >= ₹10 lakh and no GST
      //    certificate -> notify the seller (again every 7 days until uploaded).
      const sellersWithoutGst = await Seller.find({
          isActive: true,
          $or: [
              { "documents.gstCertificate": { $exists: false } },
              { "documents.gstCertificate": null },
              { "documents.gstCertificate": "" },
          ],
      }).select("_id name documents").lean();

      const remindAfter = new Date(Date.now() - GST_REMINDER_EVERY_DAYS * 24 * 60 * 60 * 1000);
      for (const seller of sellersWithoutGst) {
          if (hasGstCertificate(seller)) continue;
          const turnover = await getSellerTwelveMonthTurnover(seller._id);
          if (turnover < GST_TURNOVER_LIMIT) continue;
          const recentlyTold = await Notification.exists({
              userId: seller._id,
              type: NOTIFICATION_EVENTS.GST_LIMIT_REACHED,
              createdAt: { $gte: remindAfter },
          });
          if (recentlyTold) continue;
          emitSellerNotification(NOTIFICATION_EVENTS.GST_LIMIT_REACHED, {
              userId: seller._id,
              message: `Your transactions in the last 12 months are ₹${turnover.toLocaleString('en-IN')} (above ₹10 Lakh). Please upload your GST Certificate in your profile.`,
          });
          sentCount++;
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
