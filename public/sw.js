/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const CACHE_NAME = 'hourglass-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/icon-maskable.svg',
  '/src/main.tsx',
  '/src/index.css',
  '/src/App.tsx',
  '/src/types.ts',
  '/src/firebase.ts'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('Failed to cache some assets during sw install:', err);
      });
    })
  );
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// Fetch Event - network first, fallback to cache for offline support
self.addEventListener('fetch', (event) => {
  // Only handle standard GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip browser-extension or chrome-extension requests
  if (event.request.url.startsWith('chrome-extension') || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  const url = new URL(event.request.url);
  const isApiRequest = url.pathname.startsWith('/api/');

  // For API endpoints, fetch from the network directly and never cache to avoid stale responses
  if (isApiRequest) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(JSON.stringify({ error: 'Offline - API not available' }), {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({ 'Content-Type': 'application/json' })
        });
      })
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // If valid response, clone and cache it
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Offline - check cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If HTML page request, return index.html
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/index.html');
          }
          return new Response('Offline content not available', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({ 'Content-Type': 'text/plain' })
          });
        });
      })
  );
});

// Push Event - Receive notification from backend
self.addEventListener('push', (event) => {
  let data = { title: 'Hourglass Alert', body: 'You have an upcoming task!' };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'Hourglass Alert', body: event.data.text() };
    }
  }

  const options = {
    body: data.body,
    icon: '/icon-maskable.svg',
    badge: '/icon.svg',
    vibrate: [100, 50, 100],
    actions: data.actions || [],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
      actions: data.actions || []
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification Click Event
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
