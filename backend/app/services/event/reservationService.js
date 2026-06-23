import EventReservation from '../../models/event/EventReservation.js';
import EventBooking from '../../models/event/EventBooking.js';
import Seller from '../../models/seller.js';

export const reservationService = {
    /**
     * Step 1: Validate Availability
     * Checks if a seller can take another event on the given date
     */
    async validateAvailability(sellerId, eventDate, guestCount) {
        try {
            const seller = await Seller.findById(sellerId);
            if (!seller || !seller.isEventSeller) {
                throw new Error("Invalid event seller");
            }

            const startOfDay = new Date(eventDate);
            startOfDay.setHours(0, 0, 0, 0);
            
            const endOfDay = new Date(eventDate);
            endOfDay.setHours(23, 59, 59, 999);

            // Count existing confirmed bookings for this seller on this date
            const existingBookings = await EventBooking.countDocuments({
                'services.seller': sellerId,
                eventDate: { $gte: startOfDay, $lte: endOfDay },
                paymentStatus: 'PAID'
            });

            // Count existing temporary reservations
            const activeReservations = await EventReservation.countDocuments({
                seller: sellerId,
                eventDate: { $gte: startOfDay, $lte: endOfDay },
                status: 'RESERVED'
            });

            const totalCommitments = existingBookings + activeReservations;

            if (totalCommitments >= seller.maxEventsPerDay) {
                return { available: false, reason: "Seller capacity full for this date" };
            }

            return { available: true };
        } catch (error) {
            console.error("Availability validation error:", error);
            return { available: false, reason: error.message };
        }
    },

    /**
     * Step 2: Create Temporary Reservation
     * Locks the capacity for 15 minutes
     */
    async createTemporaryReservation(customerId, sellerId, categoryId, eventDate, eventTime, guestCount) {
        try {
            const isAvailable = await this.validateAvailability(sellerId, eventDate, guestCount);
            
            if (!isAvailable.available) {
                throw new Error(isAvailable.reason);
            }

            // Lock for 15 minutes
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000); 

            const reservation = new EventReservation({
                customer: customerId,
                seller: sellerId,
                category: categoryId,
                eventDate,
                eventTime,
                guestCount,
                expiresAt,
                status: 'RESERVED'
            });

            await reservation.save();
            return reservation;

        } catch (error) {
            throw error;
        }
    },

    /**
     * Backup Seller Assignment
     * If the primary seller is unavailable, find a replacement
     */
    async assignBackupSeller(categoryId, eventDate, coordinates) {
        // Find a seller in the same category, who is an event seller, and is available
        const sellers = await Seller.find({
            isEventSeller: true,
            isActive: true,
            // category logic would ideally match the EventCategory
            location: {
                $near: {
                    $geometry: {
                        type: "Point",
                        coordinates: coordinates
                    },
                    $maxDistance: 10000 // 10km radius
                }
            }
        });

        for (const seller of sellers) {
            const check = await this.validateAvailability(seller._id, eventDate, 1);
            if (check.available) {
                return seller;
            }
        }

        return null;
    }
};
