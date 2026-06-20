import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import fs from "fs/promises";
import { v4 as uuidv4 } from "uuid";
import sharp from "sharp";
import { fileURLToPath } from "url";

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

import MediaMetadata from "../app/models/mediaMetadata.js";
import Product from "../app/models/product.js";
import Category from "../app/models/category.js";

const STORAGE_BASE_PATH = process.env.STORAGE_BASE_PATH || path.join(process.cwd(), "uploads");
const API_DOMAIN = process.env.API_DOMAIN || "http://localhost:7000";

// For migration, we assume you have downloaded the cloudinary images to a "cloudinary_dump" folder
// structured somehow, or the script will try to fetch them.
// In this basic version, we just migrate the DB URLs. For actual file moves, we would download them.

async function downloadImage(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch ${url}`);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

async function processAndSaveImage(fileBuffer, folder) {
    const year = new Date().getFullYear().toString();
    const month = (new Date().getMonth() + 1).toString().padStart(2, '0');

    const targetDir = path.join(STORAGE_BASE_PATH, folder, year, month);
    await fs.mkdir(targetDir, { recursive: true });

    const filename = `${uuidv4()}.webp`;
    const targetPath = path.join(targetDir, filename);

    await sharp(fileBuffer)
        .webp({ quality: 80 })
        .toFile(targetPath);

    return `${API_DOMAIN}/images/${folder}/${year}/${month}/${filename}`;
}

async function migrate() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB");

        // Example: Migrate Products
        const products = await Product.find({ "images.url": /cloudinary\.com/ });
        console.log(`Found ${products.length} products with Cloudinary images.`);

        for (const product of products) {
            let updated = false;
            const newImages = [];

            for (const img of product.images) {
                if (img.url && img.url.includes("cloudinary.com")) {
                    try {
                        console.log(`Downloading ${img.url}...`);
                        const buffer = await downloadImage(img.url);
                        const newUrl = await processAndSaveImage(buffer, "products");
                        newImages.push({
                            ...img.toObject(),
                            url: newUrl,
                            secureUrl: newUrl
                        });
                        updated = true;
                        console.log(`Migrated -> ${newUrl}`);
                    } catch (e) {
                        console.error(`Failed to migrate image for product ${product._id}`, e);
                        newImages.push(img);
                    }
                } else {
                    newImages.push(img);
                }
            }

            if (updated) {
                product.images = newImages;
                await product.save();
                console.log(`Saved product ${product._id}`);
            }
        }

        console.log("Migration complete.");
        process.exit(0);
    } catch (error) {
        console.error("Migration error:", error);
        process.exit(1);
    }
}

migrate();
