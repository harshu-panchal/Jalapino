import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import sharp from "sharp";
import logger from "./logger.js";

// Determine base storage path:
// Fallback to local ./uploads directory if process.env.STORAGE_BASE_PATH is not set.
// This ensures local dev still works without requiring /var/storage
const STORAGE_BASE_PATH = process.env.STORAGE_BASE_PATH || path.join(process.cwd(), "uploads");

const VALID_FOLDERS = ["menu", "restaurants", "users", "banners", "logos", "docs", "misc"];

// Ensure the storage directories exist
export async function initializeStorage() {
    try {
        await fs.mkdir(STORAGE_BASE_PATH, { recursive: true });
        for (const folder of VALID_FOLDERS) {
            await fs.mkdir(path.join(STORAGE_BASE_PATH, folder), { recursive: true });
        }
        logger.info(`Local storage initialized at ${STORAGE_BASE_PATH}`);
    } catch (error) {
        logger.error(`Failed to initialize local storage: ${error.message}`);
    }
}

// Call it once on startup
initializeStorage();

// Determine processing rules based on folder
function getProcessingOptions(folder) {
    switch (folder) {
        case "menu":
            return { width: 800, height: 800, fit: "inside", quality: 80 };
        case "banners":
            return { width: 1920, height: 1080, fit: "inside", quality: 85 };
        case "logos":
            return { width: 400, height: 400, fit: "inside", quality: 90 };
        case "users":
            return { width: 400, height: 400, fit: "cover", quality: 80 };
        case "restaurants":
            return { width: 1200, height: 800, fit: "inside", quality: 80 };
        default:
            // No strict resizing for others, just compression
            return { quality: 80 };
    }
}

export async function processAndSaveImage(fileBuffer, folder = "misc", originalName = "") {
    if (!VALID_FOLDERS.includes(folder)) {
        folder = "misc";
    }

    const year = new Date().getFullYear().toString();
    const month = (new Date().getMonth() + 1).toString().padStart(2, '0');

    // Create year/month subdirectories
    const targetDir = path.join(STORAGE_BASE_PATH, folder, year, month);
    await fs.mkdir(targetDir, { recursive: true });

    const filename = `${uuidv4()}.webp`;
    const targetPath = path.join(targetDir, filename);

    const options = getProcessingOptions(folder);

    try {
        let pipeline = sharp(fileBuffer);

        if (options.width || options.height) {
            pipeline = pipeline.resize({
                width: options.width,
                height: options.height,
                fit: options.fit || "inside",
                withoutEnlargement: true
            });
        }

        await pipeline
            .webp({ quality: options.quality || 80 })
            .toFile(targetPath);

        const relativeUrlPath = `/images/${folder}/${year}/${month}/${filename}`;
        const isLocal = process.platform === "win32";
        const domain = process.env.API_DOMAIN || (isLocal ? "http://localhost:7000" : "https://jalpaino.com/api");
        return `${domain}${relativeUrlPath}`;
    } catch (error) {
        logger.error(`Error processing image: ${error.message}`);
        throw error;
    }
}

export async function saveRawFile(fileBuffer, folder = "docs", originalName = "") {
    if (!VALID_FOLDERS.includes(folder)) {
        folder = "misc";
    }

    const year = new Date().getFullYear().toString();
    const month = (new Date().getMonth() + 1).toString().padStart(2, '0');

    const targetDir = path.join(STORAGE_BASE_PATH, folder, year, month);
    await fs.mkdir(targetDir, { recursive: true });

    const ext = path.extname(originalName) || ".bin";
    const filename = `${uuidv4()}${ext}`;
    const targetPath = path.join(targetDir, filename);

    try {
        await fs.writeFile(targetPath, fileBuffer);
        const relativeUrlPath = `/images/${folder}/${year}/${month}/${filename}`;
        const isLocal = process.platform === "win32";
        const domain = process.env.API_DOMAIN || (isLocal ? "http://localhost:7000" : "https://jalpaino.com/api");
        return `${domain}${relativeUrlPath}`;
    } catch (error) {
        logger.error(`Error saving raw file: ${error.message}`);
        throw error;
    }
}

export async function deleteLocalFile(fileUrl) {
    try {
        const isLocal = process.platform === "win32";
        const domain = process.env.API_DOMAIN || (isLocal ? "http://localhost:7000" : "https://jalpaino.com/api");
        if (!fileUrl.startsWith(domain)) return; // Only process if it's our domain

        const relativePath = fileUrl.replace(domain, "").replace("/images/", "");
        const absolutePath = path.join(STORAGE_BASE_PATH, relativePath);

        await fs.unlink(absolutePath);
        logger.info(`Deleted local file: ${absolutePath}`);
    } catch (error) {
        if (error.code !== 'ENOENT') {
            logger.error(`Error deleting file ${fileUrl}: ${error.message}`);
        }
    }
}
