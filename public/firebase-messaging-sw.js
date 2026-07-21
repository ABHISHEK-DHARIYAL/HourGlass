/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Import and configure the Firebase SDK
// These scripts are executed in the background of the service worker
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDfN6DmwyTSHcGYAT0FpMIn0Hc-NTf1Lc0",
  authDomain: "hourglass-fadb8.firebaseapp.com",
  projectId: "hourglass-fadb8",
  storageBucket: "hourglass-fadb8.firebasestorage.app",
  messagingSenderId: "517132988601",
  appId: "1:517132988601:web:441e0c5c1ec8e661aa2b68"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message: ', payload);
  
  const notificationTitle = payload.notification?.title || payload.data?.title || 'Hourglass Alert';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'You have an update!',
    icon: payload.notification?.icon || '/icon-maskable.svg',
    badge: payload.notification?.badge || '/icon.svg',
    vibrate: [200, 100, 200],
    data: {
      time: Date.now(),
      ...payload.data
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click to close it and focus/open app window
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const clickedAction = event.action;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus if window already open
      let clientFocused = null;
      for (const client of windowClients) {
        if ('focus' in client) {
          clientFocused = client;
          break;
        }
      }

      if (clientFocused) {
        if (clickedAction && clientFocused.postMessage) {
          clientFocused.postMessage({
            type: 'NOTIFICATION_ACTION_CLICK',
            action: clickedAction
          });
        }
        return clientFocused.focus();
      }

      if (clients.openWindow) {
        return clients.openWindow('/').then((newClient) => {
          if (newClient && clickedAction) {
            // Allow a small window delay for initialization
            setTimeout(() => {
              if (newClient.postMessage) {
                newClient.postMessage({
                  type: 'NOTIFICATION_ACTION_CLICK',
                  action: clickedAction
                });
              }
            }, 3000);
          }
        });
      }
    })
  );
});
