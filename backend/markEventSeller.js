import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'node:dns';
import Seller from './app/models/seller.js';

dotenv.config();
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    const result = await Seller.updateOne(
      { shopName: 'sk kiran store' },
      { $set: { isEventSeller: true } }
    );
    console.log('Updated seller:', result);
    mongoose.disconnect();
  })
  .catch(console.error);
