import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'node:dns';
import Product from './app/models/product.js';
import Seller from './app/models/seller.js';
import Category from './app/models/category.js';

dotenv.config();
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI)
  .then(async () => {
    console.log('Connected to DB. Seeding venues...');

    // Find a seller
    const seller = await Seller.findOne({ isEventSeller: true }) || await Seller.findOne();
    if (!seller) {
      console.error('No seller found. Please register/activate a seller first.');
      mongoose.disconnect();
      return;
    }
    console.log('Using seller:', seller.shopName);

    // Find event or any category
    let category = await Category.findOne({ name: /event/i }) || await Category.findOne();
    if (!category) {
      // Create a dummy category if none exists
      category = await Category.create({
        name: 'Banquet & Venues',
        slug: 'banquet-venues',
        description: 'Premium Banquets and Venues for Events',
        status: 'active',
        level: 0
      });
    }

    // Clean up any old dummy venues to prevent duplication on re-run
    await Product.deleteMany({ name: /Dummy Venue/ });

    const dummyVenues = [
      {
        name: 'Dummy Venue - Grand Imperial Banquet',
        slug: 'dummy-venue-grand-imperial-banquet',
        sku: 'VENUE-001',
        description: 'A luxurious banquet hall perfect for royal weddings, corporate events, and large gatherings.',
        price: 150000,
        stock: 5,
        mainImage: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=600&q=80',
        galleryImages: [
          'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&w=600&q=80',
          'https://images.unsplash.com/photo-1507504038482-7621c3b64ab5?auto=format&fit=crop&w=600&q=80'
        ],
        headerId: category._id,
        categoryId: category._id,
        subcategoryId: category._id,
        sellerId: seller._id,
        status: 'active',
        approvalStatus: 'approved',
        capacityMin: 100,
        capacityMax: 500,
        venueAddress: '12 VIP Road, Near City Center',
        venueState: 'Delhi',
        venueCity: 'Delhi',
        facilities: ['Air Conditioning', 'Valet Parking', 'Catering Available', 'DJ Allowed']
      },
      {
        name: 'Dummy Venue - Royal Palace Hall',
        slug: 'dummy-venue-royal-palace-hall',
        sku: 'VENUE-002',
        description: 'An elegant venue with classical styling, perfect for birthdays, receptions, and intimate gatherings.',
        price: 80000,
        stock: 10,
        mainImage: 'https://images.unsplash.com/photo-1519225495810-7512c696505a?auto=format&fit=crop&w=600&q=80',
        galleryImages: [
          'https://images.unsplash.com/photo-1549417229-aa67d3263c09?auto=format&fit=crop&w=600&q=80'
        ],
        headerId: category._id,
        categoryId: category._id,
        subcategoryId: category._id,
        sellerId: seller._id,
        status: 'active',
        approvalStatus: 'approved',
        capacityMin: 50,
        capacityMax: 200,
        venueAddress: '78 Palace Road, Landmark Square',
        venueState: 'Delhi',
        venueCity: 'Delhi',
        facilities: ['Stage Setup', 'Parking space', 'Audio System', 'Decorations Included']
      }
    ];

    const inserted = await Product.insertMany(dummyVenues);
    console.log('Successfully seeded venues:', inserted.map(v => v.name));
    
    mongoose.disconnect();
  })
  .catch(console.error);
