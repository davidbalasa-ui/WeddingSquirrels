/* WeddingSquirrels service worker — keeps the app shell available offline.
 * The app's actual data is stored in IndexedDB by the "Download for offline"
 * button; this worker only handles the static shell and navigation fallback. */
const CACHE = "weddingsquirrels-v4";
/** How long a navigation waits on the network before using the cached copy. */
const NAVIGATION_TIMEOUT_MS = 3500;
/** Install-time shell only. Authenticated or redirecting pages (/, /today, /day) are cached on visit. */
const PRECACHE = [
  "/offline",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
  "/apple-touch-icon.png",
  "/seating-layout.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API responses are never cached; fail clearly when offline.
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response(JSON.stringify({ error: "OFFLINE" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );
    return;
  }

  // Navigations: network-first. Cache each successful page by its URL so a
  // previously opened /day, /today, /people, or /plan/timeline can reopen
  // after a network drop. Do not overwrite "/" with another route's HTML.
  if (request.mode === "navigate") {
    if (url.pathname === "/offline") {
      event.respondWith(
        caches.match("/offline").then((cached) => cached || fetch(request)),
      );
      return;
    }

    event.respondWith(
      new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("navigation timeout")),
          NAVIGATION_TIMEOUT_MS,
        );
        fetch(request).then(
          (response) => {
            clearTimeout(timer);
            resolve(response);
          },
          (error) => {
            clearTimeout(timer);
            reject(error);
          },
        );
      })
        .then((response) => {
          // A redirected response cannot be served to a navigation from cache.
          if (response.ok && !response.redirected && response.type !== "opaqueredirect") {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match("/offline"))
            .then((cached) => cached || caches.match("/")),
        ),
    );
    return;
  }

  // Next.js data fetches (client-side navigations, prefetches, router refreshes)
  // must never be served from this cache: a cached payload would show stale
  // data after an edit until the next hard reload. Let them go to the network;
  // when it is down, Next falls back to a full navigation, which is handled above.
  if (request.headers.get("RSC") || url.searchParams.has("_rsc")) return;

  // Only immutable build assets and static files are cache-first.
  const isBuildAsset = url.pathname.startsWith("/_next/static/");
  const isStaticFile = /\.(png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|webmanifest)$/i.test(url.pathname);
  if (!isBuildAsset && !isStaticFile) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
