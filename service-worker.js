importScripts('https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.0/firebase-messaging.js');

// Initialize the Firebase app in the service worker by passing in the
// messagingSenderId.
firebase.initializeApp({
  apiKey: "AIzaSyAW8rAegPAaeNltFOSBOii8GISykx3S7eU",
  authDomain: "focal-journal-app.firebaseapp.com",
  projectId: "focal-journal-app",
  storageBucket: "focal-journal-app.firebasestorage.app",
  messagingSenderId: "454247718929",
  appId: "1:454247718929:web:513ba2cbe7dc1f9e0fd1b0"
});

// Retrieve an instance of Firebase Messaging so that it can handle background
// messages.
const messaging = firebase.messaging();

const CACHE_NAME = 'focal-cache-v2';
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
  // Add the missing Firebase scripts for offline auth functionality
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js',
  'https://cdn.jsdelivr.net/npm/date-fns@4.1.0/cdn.min.js',
  'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
  'https://cdn.jsdelivr.net/npm/feather-icons/dist/feather.min.js'
];


self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        
        return cache.addAll(URLS_TO_CACHE);
      })
      .catch(error => {
        console.error('Failed to cache app shell. One or more files could not be fetched.', error);
      })
  );
});

self.addEventListener('fetch', event => {
  // Only handle GET requests for caching
  if (event.request.method !== 'GET') {
    return;
  }
  // Only cache http(s) requests
  const url = new URL(event.request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }
  // Skip chrome-extension requests
  if (url.protocol === 'chrome-extension:') {
    return;
  }
  // Use a "Network falling back to Cache" strategy.
  event.respondWith(
    fetch(event.request, {cache: "no-store"})
      .then(networkResponse => {
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          if (responseToCache && responseToCache.status === 200) {
            cache.put(event.request, responseToCache);
          }
        });
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
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

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  event.notification.close(); // Close the notification

  const data = event.notification.data || {};
  // Use self.registration.scope for correct base path
  let baseUrl = self.registration.scope;
  if (!baseUrl.endsWith('/')) baseUrl += '/';

  let targetUrl = baseUrl;

  if (data.type === 'planner' && data.plannerKey) {
    targetUrl += `?view=weekly&plannerKey=${encodeURIComponent(data.plannerKey)}`;
  } else if (data.type === 'page' && data.pageTitle) {
    targetUrl += `?view=${encodeURIComponent(data.pageTitle)}`;
  }

  event.waitUntil(clients.matchAll({ type: 'window' }).then(clientsArr => {
    // Try to focus and navigate an existing tab, otherwise open a new one as fallback
    let focused = false;
    for (const client of clientsArr) {
      if ('focus' in client) {
        client.navigate(targetUrl);
        client.focus();
        focused = true;
        break;
      }
    }
    if (!focused) {
      return clients.openWindow(targetUrl);
    }
  }));
});

// Add a listener for incoming push messages
self.addEventListener('push', event => {
  

  let title = 'Focal Journal';
  let options = {
    body: 'You have a new message.',
    icon: 'favicon192.png',
    badge: 'favicon.png'
  };

  // Check if the push event has data
  if (event.data) {
    try {
      // Gelen push verisi, içinde 'data' objesi olan bir JSON'dur.
      const payload = event.data.json();

      // 'data' objesinin içindeki 'notification' string'ini parse ediyoruz.
      const notificationData = JSON.parse(payload.data.notification);

      title = notificationData.title || 'Focal Journal Reminder';
      options = {
        body: notificationData.body,
        icon: 'favicon192.png',
        badge: 'favicon.png',
        tag: notificationData.tag,
        data: notificationData.data, // Bu, bildirime tıklandığında kullanılacak veridir.
      };
    } catch (e) {
      console.error('Push verisi ayrıştırılamadı, düz metin olarak işleniyor.', e);
      options.body = event.data.text();
    }
  }

  event.waitUntil(self.registration.showNotification(title, options));
});
