/* WeddingSquirrels service worker — keeps the app shell available offline.
 * The app's actual data is stored in IndexedDB by the "Download for offline"
 * button; this worker only handles the static shell and navigation fallback. */
const CACHE = "weddingsquirrels-v2";
/** Install-time shell only. Authenticated pages such as /day are cached on visit. */
const PRECACHE = [
  "/",
  "/today",
  "/offline",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
  "/apple-touch-icon.png",
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
      fetch(request)
        .then((response) => {
          if (response.ok) {
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

  // Static assets: cache-first with background fill.
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
