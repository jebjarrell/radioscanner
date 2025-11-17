/**
 * Service Worker for OnTheGo Scanner
 * Provides offline-first caching for static assets
 */

const CACHE_NAME = 'onthego-scanner-v1';
const RUNTIME_CACHE = 'onthego-runtime-v1';

// Assets to cache immediately on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/maps/style.json',
];

// Install event - precache core assets
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Install event');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[ServiceWorker] Precaching assets');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => {
        console.log('[ServiceWorker] Skip waiting');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[ServiceWorker] Precache failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activate event');

  const currentCaches = [CACHE_NAME, RUNTIME_CACHE];

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (!currentCaches.includes(cacheName)) {
              console.log('[ServiceWorker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[ServiceWorker] Claiming clients');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip WebSocket connections
  if (url.protocol === 'ws:' || url.protocol === 'wss:') {
    return;
  }

  // Skip localhost API calls (backend)
  if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
    // Don't cache API calls, but allow them through
    return;
  }

  // Handle static assets with cache-first strategy
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'image' ||
    request.destination === 'font' ||
    url.pathname.startsWith('/maps/')
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Handle navigation requests (HTML) with network-first strategy
  if (request.destination === 'document') {
    event.respondWith(networkFirst(request));
    return;
  }

  // Default: try network, fallback to cache
  event.respondWith(networkFirst(request));
});

/**
 * Cache-first strategy: Check cache, fallback to network
 * Best for static assets that rarely change
 */
async function cacheFirst(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('[ServiceWorker] Cache hit:', request.url);
      return cachedResponse;
    }

    console.log('[ServiceWorker] Cache miss, fetching:', request.url);
    const networkResponse = await fetch(request);

    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.error('[ServiceWorker] Cache-first failed:', error);

    // Try to return cached response even if network failed
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Return offline page or error
    return new Response('Offline - resource not cached', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: new Headers({
        'Content-Type': 'text/plain',
      }),
    });
  }
}

/**
 * Network-first strategy: Try network, fallback to cache
 * Best for dynamic content that should be fresh
 */
async function networkFirst(request) {
  try {
    console.log('[ServiceWorker] Network-first fetch:', request.url);
    const networkResponse = await fetch(request);

    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log('[ServiceWorker] Network failed, checking cache:', request.url);

    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('[ServiceWorker] Serving from cache:', request.url);
      return cachedResponse;
    }

    // Return offline fallback
    if (request.destination === 'document') {
      const offlineCache = await caches.match('/index.html');
      if (offlineCache) {
        return offlineCache;
      }
    }

    return new Response('Offline - no cached version available', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: new Headers({
        'Content-Type': 'text/plain',
      }),
    });
  }
}

// Handle messages from clients
self.addEventListener('message', (event) => {
  console.log('[ServiceWorker] Message received:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      })
    );
  }
});
