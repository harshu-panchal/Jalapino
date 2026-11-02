import EventBooking from "../models/event/EventBooking.js";
import logger from "../services/logger.js";
import { NOTIFICATION_ROLES, NOTIFICATION_EVENTS } from "../modules/notifications/notification.constants.js";
import { emitCustomerNotification, emitSellerNotification } from "../modules/notifications/notification.service.js";

/**
 * 15 minutes interval for checking completed event bookings
 */
export function getEventReviewNotificationJobInterval() {
  return 15 * 60 * 1000;
}

/**
 * Check completed events and send real-time review notification after 8 to 10 hours
 */
export async function processEventReviewNotifications() {
  try {
    const now = new Date();
    // 8 hours ago
    const eightHoursAgo = new Date(now.getTime() - (8 * 60 * 60 * 1000));

    // Find bookings marked COMPLETED at least 8 hours ago where review notification hasn't been sent yet
    const query = {
      overallStatus: 'COMPLETED',
      reviewNotificationSent: { $ne: true },
      $or: [
        { completedAt: { $exists: true, $lte: eightHoursAgo } },
        {
          completedAt: { $exists: false },
          updatedAt: { $lte: eightHoursAgo }
        }
      ]
    };

    const eligibleBookings = await EventBooking.find(query).populate('services.seller');

    if (!eligibleBookings || eligibleBookings.length === 0) {
      return 0;
    }

    logger.info(`[EventReviewNotificationJob] Found ${eligibleBookings.length} bookings eligible for 8-10h review notification`);

    let sentCount = 0;

    for (const booking of eligibleBookings) {
      try {
        const bookingDisplayId = booking.bookingId || String(booking._id).slice(-6);

        // 1. Send Real-time Customer Notification (Prompting customer to review the seller)
        if (booking.customer) {
          emitCustomerNotification(NOTIFICATION_EVENTS.EVENT_REVIEW_REMINDER, {
            userId: booking.customer,
            bookingId: booking._id,
            title: "Rate & Review Your Seller ⭐",
            message: `How was your ${booking.eventType || 'event'} (#${bookingDisplayId})? Please take a moment to rate and review your seller!`,
            data: {
              bookingId: booking._id,
              eventType: booking.eventType
            }
          });
        }

        // 2. Send Real-time Seller Notification (Informing seller of completion / review request)
        if (Array.isArray(booking.services)) {
          for (const service of booking.services) {
            const sellerId = service.seller?._id || service.seller;
            if (sellerId) {
              emitSellerNotification(NOTIFICATION_EVENTS.EVENT_REVIEW_REMINDER, {
                userId: sellerId,
                bookingId: booking._id,
                title: "Event Review Pending ⭐",
                message: `Event #${bookingDisplayId} was completed 8+ hours ago. Customer has received a notification to submit a review for your service!`,
                data: {
                  bookingId: booking._id
                }
              });
            }
          }
        }

        booking.reviewNotificationSent = true;
        booking.reviewNotificationSentAt = new Date();
        await booking.save();
        sentCount++;
      } catch (err) {
        logger.error(`[EventReviewNotificationJob] Error notifying for booking ${booking._id}:`, err);
      }
    }

    logger.info(`[EventReviewNotificationJob] Successfully sent review notifications for ${sentCount} bookings`);
    return sentCount;
  } catch (error) {
    logger.error("[EventReviewNotificationJob] Error running processEventReviewNotifications:", error);
    return 0;
  }
}

/**
 * Returns the handler for the distributed scheduler
 */
export function getEventReviewNotificationJobHandler() {
  return async () => {
    await processEventReviewNotifications();
  };
}

export default {
  processEventReviewNotifications,
  getEventReviewNotificationJobInterval,
  getEventReviewNotificationJobHandler
};

