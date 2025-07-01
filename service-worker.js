const CACHE_NAME = 'focal-cache-v1';
const URLS_TO_CACHE = [
  'index.html',
  'manifest.json',
  'css/style.css',
  'css/base.css',
  'css/layout.css',
  'css/sidebar.css',
  'css/buttons.css',
  'css/planner.css',
  'css/modal.css',
  'css/markdown.css',
  'css/goal-tracker.css',
  'css/settings.css',
  'css/calendar.css',
  'css/mobile.css',
  'js/state.js',
  'js/dom.js',
  'js/utils.js',
  'js/markdown.js',
  'js/planner.js',
  'js/library.js',
  'js/calendar.js',
  'js/init.js',
  'js/events.js',
  'js/settings.js',
  'js/cloud.js',
  'favicon.png',
  'favicon192.png',
  'favicon512.png',
  'faviconabout.png',
  'https://cdn.jsdelivr.net/npm/date-fns@4.1.0/cdn.min.js',
  'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
  'https://cdn.jsdelivr.net/npm/feather-icons/dist/feather.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache and caching app shell');
        return cache.addAll(URLS_TO_CACHE);
      })
      .catch(error => {
        console.error('Failed to cache app shell. One or more files could not be fetched.', error);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
  );
});

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
