const CACHE_NAME = 'librarycore-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/public/manifest.json',
  '/public/logo.png',
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching static assets');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event with Network-First with Cache Fallback for dynamic assets
self.addEventListener('fetch', (event) => {
  // Only handle GET requests and skip API requests / firestore calls so they handle themselves natively or via our custom offline sync
  if (event.request.method !== 'GET' || event.request.url.includes('/api/') || event.request.url.includes('firestore.googleapis.com')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // On network error, serve from cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If not in cache and it is a navigation request, return index.html (SPA routing)
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
          return new Response('Offline and not cached', { status: 503, statusText: 'Service Unavailable' });
        });
      })
  );
});

// Sync Event for background processing
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-queue') {
    console.log('[Service Worker] Background sync triggered');
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'TRIGGER_BACKGROUND_SYNC' });
        });
      })
    );
  }
});

// Message Listener for explicit syncing
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'sync') {
    console.log('[Service Worker] Sync requested by client');
    // Notify all clients to trigger their cloud synchronization
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({ type: 'TRIGGER_BACKGROUND_SYNC' });
      });
    });
  }
});
