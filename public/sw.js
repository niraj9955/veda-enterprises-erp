/* eslint-disable no-restricted-globals */

/**
 * Veda ERP Service Worker
 * ============================================
 * Powers "Add to Home Screen" on Android (Chrome requires a registered SW
 * before showing the install prompt) and provides a NetworkFirst offline
 * fallback so the app keeps working on flaky connections (very common on
 * Indian mobile networks).
 *
 * Strategy:
 *  - Static assets (JS/CSS/icons/fonts)  → StaleWhileRevalidate
 *  - API calls (/api/*)                  → NetworkFirst (5s timeout, then cache)
 *  - Navigation (HTML pages)             → NetworkFirst (so users get fresh
 *                                          HTML when online, cached HTML when
 *                                          offline — keeps the app usable
 *                                          even with no signal)
 *  - Images from external CDN            → CacheFirst, 24h
 */

const SW_VERSION = "veda-erp-v11";
const STATIC_CACHE = `${SW_VERSION}-static`;
const API_CACHE = `${SW_VERSION}-api`;
const PAGE_CACHE = `${SW_VERSION}-pages`;
const IMG_CACHE = `${SW_VERSION}-img`;

const PRECACHE_URLS = [
  "/",
  "/manifest.webmanifest",
  "/favicon.ico",
  "/icons/icon-192x192.png",
  "/icons/icon-256x256.png",
  "/icons/icon-384x384.png",
  "/icons/icon-512x512.png",
  "/icons/icon-maskable-512x512.png",
  "/icons/apple-touch-icon.png",
];

// ── Install: precache the critical shell ──────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => {
        // If any precache URL fails (e.g. offline during first install),
        // don't block the SW from activating — we'll lazy-cache on the fly.
      })
  );
  self.skipWaiting();
});

// ── Activate: clean up old caches ─────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !key.startsWith(SW_VERSION))
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── Helper: NetworkFirst with timeout ─────────────────────────────────
async function networkFirst(request, cacheName, timeoutMs = 5000) {
  const cache = await caches.open(cacheName);
  try {
    const networkTimeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("network-timeout")), timeoutMs)
    );
    const networkResponse = await Promise.race([
      fetch(request),
      networkTimeout,
    ]);
    // Only cache successful, basic (non-opaque) responses
    if (networkResponse && networkResponse.ok && networkResponse.type === "basic") {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    // If it's a navigation request and we have no cached page, fall back
    // to the cached root shell so the user at least sees the app.
    if (request.mode === "navigate") {
      const rootCache = await caches.open(PAGE_CACHE);
      const rootMatch = await rootCache.match("/");
      if (rootMatch) return rootMatch;
    }
    throw err;
  }
}

// ── Helper: StaleWhileRevalidate ──────────────────────────────────────
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached); // offline → return whatever we have
  return cached || fetchPromise;
}

// ── Helper: CacheFirst (for images) ───────────────────────────────────
async function cacheFirst(request, cacheName, maxAgeMs = 24 * 60 * 60 * 1000) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    // Check age — if too old, revalidate in background
    const dateHeader = cached.headers.get("date");
    if (dateHeader) {
      const age = Date.now() - new Date(dateHeader).getTime();
      if (age < maxAgeMs) return cached;
    } else {
      return cached;
    }
  }
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    if (cached) return cached;
    throw err;
  }
}

// ── Fetch handler ─────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET — ignore POST/PUT/DELETE (let them hit the network)
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Skip Chrome extension requests
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  // Same-origin API → NetworkFirst
  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request, API_CACHE, 5000));
    return;
  }

  // Same-origin navigation (HTML pages) → NetworkFirst with offline fallback
  // 3s cap: slow networks must not keep serving a stale cached shell —
  // this was letting old builds stick around on flaky mobile connections.
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, PAGE_CACHE, 3000));
    return;
  }

  // Static assets on same origin → StaleWhileRevalidate
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
    return;
  }

  // External images (e.g. dashboard tile photos from sfile.chatglm.cn)
  if (
    request.destination === "image" ||
    /\.(?:png|jpg|jpeg|gif|webp|svg|ico)$/i.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(request, IMG_CACHE));
    return;
  }

  // Everything else: just hit the network, no caching
  // (default browser behavior)
});

// ── Message handler: allow page to trigger skipWaiting ────────────────
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
