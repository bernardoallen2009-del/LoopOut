const CACHE_NAME = 'loopout-v7';
const APP_SHELL = [
  '/',
  '/dashboard',
  '/login',
  '/session/select-app',
  '/session/purpose',
  '/session/timer',
  '/session/active',
  '/session/locked',
  '/pass',
  '/friends',
  '/places',
  '/rewards',
  '/partner/scan',
  '/partner/dashboard',
  '/partners',
  '/partners/suggest',
  '/admin',
  '/progress',
  '/screen-time-import',
  '/setup-iphone',
  '/manifest.webmanifest',
  '/loopout-logo-512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

async function cacheResponse(request, response) {
  if (!response || response.status !== 200 || response.type === 'opaque') return;
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  } catch {
    // Cache writes should never block a successful network response.
  }
}

async function networkFirst(request, fallbackUrl = '/') {
  try {
    const response = await fetch(request);
    await cacheResponse(request, response);
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || caches.match(fallbackUrl);
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const fresh = fetch(request)
    .then(async (response) => {
      await cacheResponse(request, response);
      return response;
    })
    .catch(() => null);

  return cached || fresh || caches.match('/');
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirst(event.request));
    return;
  }

  if (['script', 'style', 'worker', 'document'].includes(event.request.destination)) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  if (['image', 'manifest'].includes(event.request.destination)) {
    event.respondWith(staleWhileRevalidate(event.request));
  }
});
