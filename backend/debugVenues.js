import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'node:dns';
import Product from './app/models/product.js';

dotenv.config();
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI)
  .then(async () => {
    console.log('--- Diagnosing Venues ---');
    const allProducts = await Product.find({}).lean();
    console.log('Total products in DB:', allProducts.length);
    
    const activeProducts = await Product.find({ status: 'active' }).lean();
    console.log('Active products in DB:', activeProducts.length);

    const venues = await Product.find({
      status: 'active',
      $or: [
        { venueState: { $exists: true, $ne: '' } },
        { capacityMax: { $gt: 0 } }
      ]
    }).lean();
    console.log('Venues matching search query filter:', venues.length);
    if (venues.length > 0) {
      console.log('Sample venue:', {
        name: venues[0].name,
        status: venues[0].status,
        venueState: venues[0].venueState,
        venueCity: venues[0].venueCity,
        capacityMax: venues[0].capacityMax
      });
    }

    mongoose.disconnect();
  })
  .catch(console.error);
