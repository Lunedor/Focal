const CACHE_NAME = 'focal-cache-v1';
// This list should include all your core application files.
const URLS_TO_CACHE = [
  'Focal/index.html',
  'Focal/manifest.json',
  'Focal/css/style.css',
  'Focal/js/state.js',
  'Focal/js/dom.js',
  'Focal/js/utils.js',
  'Focal/js/markdown.js',
  'Focal/js/planner.js',
  'Focal/js/library.js',
  'Focal/js/calendar.js',
  'Focal/js/init.js',
  'Focal/js/events.js',
  'Focal/js/settings.js',
  'Focal/js/cloud.js',
  'Focal/favicon.png',
  'Focal/favicon192.png',
  'Focal/favicon512.png',
  // External CDN resources
  'https://cdn.jsdelivr.net/npm/date-fns@4.1.0/cdn.min.js',
  'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
  'https://cdn.jsdelivr.net/npm/feather-icons/dist/feather.min.js'
];

// Install event: opens a cache and adds the core app shell files to it.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache and caching app shell');
        return cache.addAll(URLS_TO_CACHE);
      })
  );
});

// Fetch event: serves assets from the cache first (cache-first strategy).
// This is what makes the app available offline and is required for installability.
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // If the request is in the cache, return it. Otherwise, fetch from the network.
        return response || fetch(event.request);
      })
  );
});

// Activate event: cleans up old, unused caches.
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => Promise.all(
      cacheNames.map(cacheName => {
        if (cacheWhitelist.indexOf(cacheName) === -1) {
          return caches.delete(cacheName);
        }
      })
    ))
  );
});
