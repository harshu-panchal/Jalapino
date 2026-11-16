// Scripts for firebase and firebase messaging
importScripts('https://www.gstatic.com/firebasejs/9.2.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.2.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker
const firebaseConfig = {
  apiKey: "AIzaSyCB2P2ZD1WLe0ojidM5kRT4j1EvTrVou0Y",
  authDomain: "jalpaino.firebaseapp.com",
  projectId: "jalpaino",
  storageBucket: "jalpaino.firebasestorage.app",
  messagingSenderId: "313718365602",
  appId: "1:313718365602:web:088fc02a92389533dfe6fb",
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);

  // Messages that carry a `notification` block are already shown by Firebase
  // itself (with the Jalpaino logo and link). Showing it here too would make
  // the same notification appear twice.
  if (payload.notification) return;

  // Data-only messages: show one notification ourselves.
  const data = payload.data || {};
  const notificationTitle = data.title || 'Jalpaino';
  const notificationOptions = {
    body: data.body || data.message || '',
    icon: data.image || '/logo2.png',
    tag: data.bookingId || data.orderId || data.eventType || undefined,
    data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', function(event) {
    // Notifications shown by Firebase itself open their own link; don't open a
    // second tab from here.
    if (event.notification.data && event.notification.data.FCM_MSG) return;
    event.notification.close();
    
    // Check if deep link is provided in data
    const urlToOpen = event.notification.data?.link || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            // Check if there is already a window/tab open with the target URL
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                // If so, just focus it.
                if (client.url === urlToOpen && 'focus' in client) {
                    return client.focus();
                }
            }
            // If not, then open the target URL in a new window/tab.
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});
