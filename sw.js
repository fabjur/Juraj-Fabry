
const CACHE_NAME = 'sai-app-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  // Add other static assets here if they were local files. 
  // Since this app uses CDNs for React and Tailwind in index.html, 
  // the browser HTTP cache handles them, but we can explicitly cache the app shell.
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // For API calls or external resources, we might want Network First or Stale While Revalidate.
  // For the app shell (same origin), we use Cache First.
  
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/index.html');
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
