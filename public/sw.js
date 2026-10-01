/* SIGNA · Logística — service worker
 * - Estáticos de Next (/_next/static) y públicos: primero caché.
 * - Pantallas: primero red; si no hay señal, la última versión guardada; si no, /offline.
 * - Nada de /api ni server actions se guarda en caché.
 */
const VERSION = "signa-v1";
const ESTATICOS = `${VERSION}-estaticos`;
const PANTALLAS = `${VERSION}-pantallas`;

const PRECARGA = [
  "/offline",
  "/img/inicio-app.jpg",
  "/img/inicio-sistema.jpg",
  "/img/logo-640.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(caches.open(ESTATICOS).then((c) => c.addAll(PRECARGA)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (evento) => {
  const { request } = evento;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    // Teselas del mapa: caché oportunista para que el mapa se vea sin señal.
    if (url.hostname.endsWith("tile.openstreetmap.org")) {
      evento.respondWith(
        caches.open(`${VERSION}-mapa`).then(async (c) => {
          const guardada = await c.match(request);
          const red = fetch(request)
            .then((r) => {
              if (r.ok) c.put(request, r.clone());
              return r;
            })
            .catch(() => guardada);
          return guardada || red;
        }),
      );
    }
    return;
  }
  if (url.pathname.startsWith("/api/")) return;
  if (request.headers.get("RSC") || url.searchParams.has("_rsc")) return;

  if (url.pathname.startsWith("/_next/static/") || /\.(png|jpg|jpeg|svg|webp|ico|woff2?)$/.test(url.pathname)) {
    evento.respondWith(
      caches.match(request).then(
        (guardada) =>
          guardada ||
          fetch(request).then((r) => {
            if (r.ok) caches.open(ESTATICOS).then((c) => c.put(request, r.clone()));
            return r;
          }),
      ),
    );
    return;
  }

  if (request.mode === "navigate") {
    evento.respondWith(
      fetch(request)
        .then((r) => {
          if (r.ok && !r.redirected) {
            const copia = r.clone();
            caches.open(PANTALLAS).then((c) => c.put(request, copia));
          }
          return r;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match("/offline"))),
    );
  }
});
