/* SIGNA · Logística — service worker
 * Estáticos: primero caché. Pantallas: primero red; sin señal, la última versión guardada.
 * Nada de /api ni Server Actions se guarda en caché.
 */
const VERSION = "signa-v3";
const ESTATICOS = `${VERSION}-estaticos`;
const PANTALLAS = `${VERSION}-pantallas`;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(ESTATICOS).then((c) => c.addAll(["/offline", "/signalogo.png", "/icons/icon-192.png", "/icons/icon-512.png"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (request.headers.get("RSC") || url.searchParams.has("_rsc")) return;

  if (url.pathname.startsWith("/_next/static/") || /\.(png|jpg|jpeg|svg|webp|ico|woff2?)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(request).then(
        (g) =>
          g ||
          fetch(request).then((r) => {
            if (r.ok) caches.open(ESTATICOS).then((c) => c.put(request, r.clone()));
            return r;
          }),
      ),
    );
    return;
  }

  if (request.mode === "navigate") {
    e.respondWith(
      fetch(request)
        .then((r) => {
          if (r.ok && !r.redirected) {
            const copia = r.clone();
            caches.open(PANTALLAS).then((c) => c.put(request, copia));
          }
          return r;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match("/offline")) || Response.error()),
    );
  }
});
