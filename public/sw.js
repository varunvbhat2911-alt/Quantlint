/* QuantLint Service Worker
 *
 * Conservative caching strategy — never caches authenticated or private data.
 * Only static assets (JS, CSS, images, fonts) are cached with a stale-while-
 * revalidate strategy. HTML pages use network-first so offline users see the
 * last-visited shell without risking stale private content.
 *
 * API routes (/api/*), Supabase endpoints, and any request with credentials
 * are always fetched from the network. This prevents cross-user data leakage.
 */

const CACHE_VERSION = "ql-v1";
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const PAGE_CACHE = `pages-${CACHE_VERSION}`;

/* File extensions considered safe to cache (static, non-personal assets). */
const STATIC_EXTENSIONS = [
  ".js",
  ".css",
  ".png",
  ".jpg",
  ".jpeg",
  ".svg",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".webp",
];

/* URL patterns that must NEVER be cached. */
const NEVER_CACHE_PATTERNS = [
  "/api/",
  "/auth/",
  "supabase",
  "fireworks",
  "/_next/data/",
];

function isStaticAsset(url) {
  try {
    const pathname = new URL(url).pathname;
    return STATIC_EXTENSIONS.some((ext) => pathname.endsWith(ext));
  } catch {
    return false;
  }
}

function shouldSkipCache(request, url) {
  /* Never cache non-GET requests */
  if (request.method !== "GET") return true;

  /* Never cache requests with credentials (auth cookies, tokens) */
  if (request.credentials === "include") return true;

  /* Never cache API routes or known sensitive patterns */
  const href = url.href;
  if (NEVER_CACHE_PATTERNS.some((p) => href.includes(p))) return true;

  return false;
}

/* ── Install: pre-cache the app shell ─────────────────────── */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      /* Pre-cache only the offline fallback — static assets are cached
       * on first visit to avoid bloating the install step. */
      return cache.add("/offline.html").catch(() => {
        /* offline.html may not exist yet; that's fine */
      });
    }),
  );
  self.skipWaiting();
});

/* ── Activate: clean old caches ───────────────────────────── */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== PAGE_CACHE)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

/* ── Fetch: network-first for pages, cache-first for static ─ */
self.addEventListener("fetch", (event) => {
  const { request } = event;
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  /* Same-origin only — never intercept cross-origin requests */
  if (url.origin !== self.location.origin) return;

  /* Skip caching for sensitive requests */
  if (shouldSkipCache(request, url)) return;

  /* Static assets: cache-first with network fallback */
  if (isStaticAsset(url.href)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      }),
    );
    return;
  }

  /* HTML navigation: network-first with offline fallback */
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(PAGE_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match("/offline.html")),
        ),
    );
    return;
  }
});
