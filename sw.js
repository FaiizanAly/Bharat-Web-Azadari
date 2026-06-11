// ============================================================
// BHARAT WEB AZADARI — Service Worker (sw.js)
// ============================================================
// Strategy:
//   • Static assets (CSS, JS, images) → Cache-First
//   • Navigation (HTML pages)          → Network-First, fallback cache
//   • Google Apps Script API           → Network-Only (never cache)
//   • YouTube RSS / allorigins         → Network-First, 30 min cache
// ============================================================

const CACHE_NAME    = 'bwa-v1.0.0';
const CACHE_RUNTIME = 'bwa-runtime-v1.0.0'; // For dynamic/YouTube cache

// Static files to pre-cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/about.html',
  '/programs.html',
  '/gallery.html',
  '/videos.html',
  '/contact.html',
  '/404.html',
  '/css/main.css',
  '/css/components.css',
  '/js/config.js',
  '/js/api.js',
  '/js/main.js',
  '/js/home.js',
  '/js/programs.js',
  '/js/gallery.js',
  '/js/videos.js',
  '/js/contact.js',
  '/manifest.json',
  '/assets/logo.png',
];

// Cache duration for YouTube RSS (30 minutes in milliseconds)
const YOUTUBE_CACHE_MAX_AGE = 30 * 60 * 1000;

// ============================================================
// INSTALL — Pre-cache all static assets
// ============================================================
self.addEventListener('install', event => {
  console.log('[SW] Installing service worker, version:', CACHE_NAME);

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Pre-caching static assets...');
        // Use addAll — if any asset fails, the whole install fails gracefully
        // We wrap individual adds to not fail on missing assets during dev
        return Promise.allSettled(
          STATIC_ASSETS.map(url =>
            cache.add(url).catch(err => {
              console.warn('[SW] Failed to cache:', url, err.message);
            })
          )
        );
      })
      .then(() => {
        console.log('[SW] Static assets cached. Calling skipWaiting...');
        return self.skipWaiting(); // Activate immediately without waiting
      })
  );
});

// ============================================================
// ACTIVATE — Clean up old caches
// ============================================================
self.addEventListener('activate', event => {
  console.log('[SW] Activating service worker, version:', CACHE_NAME);

  const allowedCaches = [CACHE_NAME, CACHE_RUNTIME];

  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => !allowedCaches.includes(name))
            .map(name => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Old caches cleared. Claiming clients...');
        return self.clients.claim(); // Take control of all open tabs immediately
      })
  );
});

// ============================================================
// FETCH — Route requests to appropriate strategy
// ============================================================
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // ── 1. Never cache non-GET requests (POST, etc.) ──────────
  if (request.method !== 'GET') {
    return; // Let it fall through to the network
  }

  // ── 2. Google Apps Script API → Network-Only ───────────────
  // GAS responses are dynamic and must never be cached
  if (
    url.hostname.includes('script.google.com') ||
    url.hostname.includes('script.googleusercontent.com')
  ) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({ success: false, error: 'You are offline. Please check your connection.' }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // ── 3. YouTube RSS / allorigins proxy → Network-First, 30 min cache ──
  if (
    url.hostname.includes('youtube.com') ||
    url.hostname.includes('allorigins.win') ||
    url.hostname.includes('youtu.be')
  ) {
    event.respondWith(youtubeCacheStrategy(request));
    return;
  }

  // ── 4. Navigation requests (HTML pages) → Network-First ───
  if (request.mode === 'navigate') {
    event.respondWith(navigationStrategy(request));
    return;
  }

  // ── 5. Google Fonts → Cache-First (external, long-lived) ──
  if (
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) {
    event.respondWith(cacheFirstStrategy(request, CACHE_RUNTIME));
    return;
  }

  // ── 6. Static assets (CSS, JS, images) → Cache-First ──────
  const isStaticAsset = (
    url.pathname.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf)$/)
  );

  if (isStaticAsset) {
    event.respondWith(cacheFirstStrategy(request, CACHE_NAME));
    return;
  }

  // ── 7. Anything else → Network with cache fallback ─────────
  event.respondWith(networkFirstStrategy(request));
});

// ============================================================
// STRATEGY IMPLEMENTATIONS
// ============================================================

/**
 * Cache-First Strategy
 * Try the cache first; if not found, fetch from network and cache the result.
 * Best for: CSS, JS, images, fonts
 */
async function cacheFirstStrategy(request, cacheName) {
  const cache    = await caches.open(cacheName);
  const cached   = await cache.match(request);

  if (cached) {
    return cached;
  }

  try {
    const networkResponse = await fetch(request);
    // Only cache valid responses
    if (networkResponse && networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    console.warn('[SW] Cache-First: Network failed and no cache for:', request.url);
    return new Response('Resource unavailable offline.', { status: 503 });
  }
}

/**
 * Network-First Strategy
 * Try the network; if it fails, return cached version.
 * Best for: HTML pages, dynamic content
 */
async function networkFirstStrategy(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response('Resource unavailable offline.', { status: 503 });
  }
}

/**
 * Navigation Strategy (for HTML page requests)
 * Try network first; fallback to cached index.html; last resort: 404.html
 */
async function navigationStrategy(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    // Try fetching the actual page from network
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
    throw new Error('Network response not OK: ' + networkResponse.status);
  } catch (err) {
    console.warn('[SW] Navigation: Network failed for', request.url, '— falling back to cache.');

    // Try cached version of the specific page
    const cachedPage = await cache.match(request);
    if (cachedPage) return cachedPage;

    // Fallback to cached index.html
    const cachedIndex = await cache.match('/index.html');
    if (cachedIndex) return cachedIndex;

    // Last resort: 404 page
    const cached404 = await cache.match('/404.html');
    if (cached404) return cached404;

    // Absolute fallback — plain text
    return new Response(
      `<!DOCTYPE html>
      <html lang="en">
      <head><meta charset="UTF-8"><title>Offline — BWA</title></head>
      <body style="background:#0B0B0B;color:#D4AF37;font-family:sans-serif;text-align:center;padding:60px 20px;">
        <h1>You're Offline</h1>
        <p>Please check your internet connection and try again.</p>
        <a href="/" style="color:#D4AF37;">← Go Home</a>
      </body>
      </html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
}

/**
 * YouTube Cache Strategy — Network-First with 30-minute expiry
 * Caches YouTube RSS and allorigins proxy responses for 30 minutes.
 */
async function youtubeCacheStrategy(request) {
  const cache     = await caches.open(CACHE_RUNTIME);
  const cacheKey  = request.url;
  const cached    = await cache.match(cacheKey);

  // Check if cached response is still fresh (< 30 minutes old)
  if (cached) {
    const cachedDate = cached.headers.get('sw-cached-at');
    if (cachedDate) {
      const age = Date.now() - parseInt(cachedDate, 10);
      if (age < YOUTUBE_CACHE_MAX_AGE) {
        console.log('[SW] Serving YouTube/allorigins from cache (age:', Math.round(age / 1000), 's)');
        return cached;
      }
    }
  }

  // Cache is stale or missing — fetch from network
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      // Clone and add timestamp header before caching
      const headers    = new Headers(networkResponse.headers);
      headers.set('sw-cached-at', Date.now().toString());
      const timestamped = new Response(await networkResponse.clone().blob(), {
        status:     networkResponse.status,
        statusText: networkResponse.statusText,
        headers
      });
      cache.put(cacheKey, timestamped);
      return networkResponse;
    }
    throw new Error('Non-200 response: ' + networkResponse.status);
  } catch (err) {
    // Return stale cache if available (better than nothing)
    if (cached) {
      console.warn('[SW] YouTube fetch failed, serving stale cache.');
      return cached;
    }
    return new Response('YouTube content unavailable offline.', { status: 503 });
  }
}

// ============================================================
// MESSAGE HANDLING (from main thread)
// ============================================================
self.addEventListener('message', event => {
  // Allow pages to send control messages to the SW

  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Received SKIP_WAITING message. Activating...');
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME).then(() => caches.delete(CACHE_RUNTIME)).then(() => {
      console.log('[SW] All caches cleared on request.');
    });
  }
});
