import mongoose from "mongoose";
import dotenv from "dotenv";
import Seller from "./app/models/seller.js";
import EventCategory from "./app/models/event/EventCategory.js";
import dns from "node:dns";

dotenv.config();
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const seedSellers = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
        console.log("Connected to MongoDB for seeding sellers.");

        // Fetch categories to link to sellers
        const cateringCat = await EventCategory.findOne({ name: /Catering/i });
        const decoCat = await EventCategory.findOne({ name: /Decoration/i });
        const photoCat = await EventCategory.findOne({ name: /Photography/i });

        const categories = [cateringCat, decoCat, photoCat].filter(Boolean);

        if (categories.length === 0) {
            console.log("No EventCategories found in DB. Please create them in Admin panel first.");
            process.exit(0);
        }

        const sampleSellers = [
            {
                name: "Rahul Verma",
                email: "rahul@kimayacaterers.com",
                phone: "9876543210",
                password: "password123", // Will be hashed by pre-save hook
                shopName: "Kimaya Premium Caterers",
                description: "Authentic multi-cuisine catering services with 15+ years of experience in grand weddings and corporate events. Specializing in Rajasthani, Punjabi, and Continental.",
                address: "Shop 12, Malviya Nagar",
                city: "Jaipur",
                state: "Rajasthan",
                pincode: "302017",
                isVerified: true,
                isActive: true,
                isEventSeller: true,
                serviceCategories: cateringCat ? [cateringCat._id] : [],
                maxEventsPerDay: 2,
                maxGuestCapacity: 1500,
                serviceRadius: 50,
                businessTimings: { start: "08:00", end: "23:00" },
                sellerStatus: "active",
                sellerVerificationStatus: "verified"
            },
            {
                name: "Sneha Sharma",
                email: "sneha@elegantdecor.com",
                phone: "9876543211",
                password: "password123",
                shopName: "Elegant Events & Decor",
                description: "Award-winning decoration and event planning agency. We transform ordinary venues into magical spaces. Specializing in floral, thematic, and luxury weddings.",
                address: "C-Scheme",
                city: "Jaipur",
                state: "Rajasthan",
                pincode: "302001",
                isVerified: true,
                isActive: true,
                isEventSeller: true,
                serviceCategories: decoCat ? [decoCat._id] : [],
                maxEventsPerDay: 3,
                maxGuestCapacity: 2000,
                serviceRadius: 30,
                businessTimings: { start: "09:00", end: "20:00" },
                sellerStatus: "active",
                sellerVerificationStatus: "verified"
            },
            {
                name: "Amit Kumar",
                email: "amit@lenscraft.com",
                phone: "9876543212",
                password: "password123",
                shopName: "Lenscraft Photography Studio",
                description: "Candid wedding photography and cinematic videography. Capturing the real emotions of your special day.",
                address: "Vaishali Nagar",
                city: "Jaipur",
                state: "Rajasthan",
                pincode: "302021",
                isVerified: true,
                isActive: true,
                isEventSeller: true,
                serviceCategories: photoCat ? [photoCat._id] : [],
                maxEventsPerDay: 4,
                maxGuestCapacity: 5000, // Photos don't have strict guest limits usually, but just for DB
                serviceRadius: 100,
                businessTimings: { start: "06:00", end: "23:59" },
                sellerStatus: "active",
                sellerVerificationStatus: "verified"
            }
        ];

        for (const sellerData of sampleSellers) {
            const existing = await Seller.findOne({ email: sellerData.email });
            if (!existing) {
                const seller = new Seller(sellerData);
                await seller.save();
                console.log(`Created seller: ${seller.shopName}`);
            } else {
                // Update existing
                Object.assign(existing, sellerData);
                await existing.save();
                console.log(`Updated seller: ${existing.shopName}`);
            }
        }

        console.log("Seeding complete!");
        process.exit(0);
    } catch (error) {
        console.error("Seeding failed:", error);
        process.exit(1);
    }
};

seedSellers();
