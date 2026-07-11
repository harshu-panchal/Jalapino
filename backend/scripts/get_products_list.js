import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function getProducts() {
    try {
        await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://localhost:27017/jalapino");
        const db = mongoose.connection.db;
        const products = await db.collection('products').find({}).limit(5).toArray();
        console.log("\n--- PRODUCT LIST FOR BANNER LINKING ---");
        products.forEach(p => {
            console.log(`Name: ${p.name || 'Unnamed'} | ID: ${p._id}`);
        });
        console.log("---------------------------------------\n");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

getProducts();
