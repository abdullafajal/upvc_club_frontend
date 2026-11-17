const CACHE_NAME = 'upvc-club-cache-v10';

// Core assets cached on install (versioned via ?v= in the HTML)
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './visualizer.html',
  './manifest.json',
  './assets/css/site.css?v=2.1.1',
  './assets/css/visualizer.css?v=2.1.1',
  './assets/js/api.js?v=2.1.1',
  './assets/js/site.js?v=2.1.1',
  './assets/js/frames.js?v=2.1.1',
  './assets/js/visualizer.js?v=2.1.1',
  './assets/vendor/gsap.min.js',
  './assets/vendor/ScrollTrigger.min.js',
  './assets/vendor/SplitText.min.js',
  './assets/vendor/lenis.min.js',
  './assets/icons/logo-68.webp',
  './assets/fonts/manrope-variable.woff2',
  './assets/fonts/material-icons-outlined-subset.woff2'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      // a missing asset must not break installation
      .then(cache => Promise.all(PRECACHE_ASSETS.map(url => cache.add(url).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

function networkFirst(request) {
  return fetch(request)
    .then(response => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      }
      return response;
    })
    .catch(() => caches.match(request));
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (!url.protocol.startsWith('http')) return;

  // API + HTML: network first, fall back to cache when offline
  if (url.pathname.startsWith('/api/') || (request.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Media from the backend (product/portfolio images) and analytics: straight to network
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.pathname.startsWith('/media/') || (url.hostname.includes('google') && !isFont)) return;

  // Static assets: cache first
  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response && (response.ok || response.type === 'opaque')) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      }
      return response;
    }))
  );
});
