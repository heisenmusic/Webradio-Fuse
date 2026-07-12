/* Fuse Radio Enterprise — service worker (PWA).
 * Cacheia o shell da aplicação; streams de áudio NUNCA são cacheados. */

const CACHE = "fuse-shell-v1";
const SHELL = ["/", "/player", "/admin", "/manifest.webmanifest", "/icons/fuse.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Nunca interceptar áudio/streaming ou chamadas de API.
  if (
    event.request.destination === "audio" ||
    url.pathname.includes("/stream") ||
    url.pathname.startsWith("/v1/")
  ) {
    return;
  }

  // Network-first com fallback para cache (funciona offline no shell).
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (event.request.method === "GET" && res.ok && url.origin === location.origin) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(event.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(event.request).then((hit) => hit ?? Response.error())),
  );
});
