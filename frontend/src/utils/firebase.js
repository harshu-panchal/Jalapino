// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBKSYYuaaEElPtw3XMOWAgCm_N6QqS0-n4",
  authDomain: "jalapino-a9ea3.firebaseapp.com",
  projectId: "jalapino-a9ea3",
  storageBucket: "jalapino-a9ea3.firebasestorage.app",
  messagingSenderId: "489934865244",
  appId: "1:489934865244:web:f8de525d63213f35c4f799",
  measurementId: "G-VSGJ9RJ5MQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
let analytics;
if (typeof window !== "undefined") {
  analytics = getAnalytics(app);
}

let messaging = null;

export const getFirebaseMessaging = () => {
    if (typeof window !== "undefined" && 'serviceWorker' in navigator) {
        if (!messaging) {
            try {
                messaging = getMessaging(app);
            } catch (error) {
                console.error("Firebase Messaging failed to initialize", error);
            }
        }
        return messaging;
    }
    return null;
};

export const requestNotificationPermission = async () => {
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            const messaging = getFirebaseMessaging();
            if (messaging) {
                const token = await getToken(messaging, { 
                    vapidKey: 'BAiQVkeWur1OSAbhfHE2E5yonqh3_5KP6xqFl7XIeK_vsLNA7IuG8IOduBOiQKAHPqI-1etp6PDPm457l4-WYE4' 
                });
                return token;
            }
        } else {
            console.warn('Notification permission not granted.');
        }
    } catch (error) {
        console.error('An error occurred while requesting permission. ', error);
    }
    return null;
};

export const onMessageListener = () =>
    new Promise((resolve) => {
        const messaging = getFirebaseMessaging();
        if (messaging) {
            onMessage(messaging, (payload) => {
                resolve(payload);
            });
        }
    });

export default app;
