const CACHE_NAME = 'focal-cache-v1';
const URLS_TO_CACHE = [
  '/Focal/',
  '/Focal/index.html',
  '/Focal/favicon.png',
  '/Focal/favicon.ico',
  '/Focal/faviconabout.png',
  '/Focal/manifest.json',
  '/Focal/css/base.css',
  '/Focal/css/buttons.css',
  '/Focal/css/calendar.css',
  '/Focal/css/goal-tracker.css',
  '/Focal/css/layout.css',
  '/Focal/css/main.css',
  '/Focal/css/markdown.css',
  '/Focal/css/mobile.css',
  '/Focal/css/modal.css',
  '/Focal/css/planner.css',
  '/Focal/css/settings.css',
  '/Focal/css/sidebar.css',
  '/Focal/css/style.css',
  '/Focal/js/calendar.js',
  '/Focal/js/cloud.js',
  '/Focal/js/dom.js',
  '/Focal/js/events.js',
  '/Focal/js/init.js',
  '/Focal/js/library.js',
  '/Focal/js/markdown.js',
  '/Focal/js/planner.js',
  '/Focal/js/settings.js',
  '/Focal/js/state.js',
  '/Focal/js/utils.js'
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
