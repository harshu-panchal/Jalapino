import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    const Category = mongoose.model('Category', new mongoose.Schema({}, { strict: false, collection: 'categories' }));
    const headers = await Category.find({ type: 'header' }, { name: 1, type: 1, applicableModules: 1 }).lean();
    console.log("Headers:", headers);
    process.exit(0);
  });
