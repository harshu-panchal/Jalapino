import fs from "fs";
import dotenv from "dotenv";
import admin from "firebase-admin";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

let firebaseAdminApp = null;

/**
 * Returns a firebase-admin app when FIREBASE_SERVICE_ACCOUNT (JSON string)
 * is set. FIREBASE_DATABASE_URL is optional (required only for Realtime DB).
 */
export const getFirebaseAdminApp = () => {
  if (firebaseAdminApp) return firebaseAdminApp;

  const jsonString = process.env.FIREBASE_SERVICE_ACCOUNT;
  const databaseURL = process.env.FIREBASE_DATABASE_URL;
  let serviceAccount = null;

  try {
    if (jsonString) {
      serviceAccount = JSON.parse(jsonString);
    } else {
      // Fallback to the json file provided
      const jsonPath = path.resolve(__dirname, 'jalapino-a9ea3-firebase-adminsdk-fbsvc-30c9a93c40.json');
      if (fs.existsSync(jsonPath)) {
        serviceAccount = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      }
    }
  } catch (err) {
    console.warn("Failed to parse firebase service account json:", err.message);
  }

  if (!serviceAccount) {
    return null;
  }

  try {
    const config = {
      credential: admin.credential.cert(serviceAccount),
    };
    if (databaseURL) {
      config.databaseURL = databaseURL;
    }
    firebaseAdminApp = admin.initializeApp(config);
    return firebaseAdminApp;
  } catch (e) {
    console.warn("[Firebase] Init skipped:", e.message);
    return null;
  }
};

export const getFirebaseRealtimeDb = () => {
  const app = getFirebaseAdminApp();
  if (!app) return null;
  return admin.database(app);
};

