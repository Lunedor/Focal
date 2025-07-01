// This is the service worker for Focal Planner PWA
const CACHE_NAME = 'focal-cache-v1';
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/favicon.png',
  '/css/base.css',
  '/css/main.css',
  '/js/init.js',
  '/js/planner.js',
  '/js/cloud.js',
  // Add more files as needed
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(URLS_TO_CACHE);
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
