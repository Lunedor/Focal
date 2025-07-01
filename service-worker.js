const CACHE_NAME = 'focal-cache-v1';
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/favicon.png',
  '/favicon.ico',
  '/faviconabout.png',
  '/manifest.json',
  '/css/base.css',
  '/css/buttons.css',
  '/css/calendar.css',
  '/css/goal-tracker.css',
  '/css/layout.css',
  '/css/main.css',
  '/css/markdown.css',
  '/css/mobile.css',
  '/css/modal.css',
  '/css/planner.css',
  '/css/settings.css',
  '/css/sidebar.css',
  '/css/style.css',
  '/js/calendar.js',
  '/js/cloud.js',
  '/js/dom.js',
  '/js/events.js',
  '/js/init.js',
  '/js/library.js',
  '/js/markdown.js',
  '/js/planner.js',
  '/js/settings.js',
  '/js/state.js',
  '/js/utils.js'
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
