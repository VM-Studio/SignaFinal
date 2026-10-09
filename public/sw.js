/* SIGNA · Logística — service worker
 * Estáticos: primero caché. Pantallas: primero red; sin señal, la última versión guardada.
 * Nada de /api ni Server Actions se guarda en caché.
 */
const VERSION = "signa-v9";
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

// Avisos push. SIEMPRE se muestra una notificación (iPhone corta los avisos si una push no muestra
// nada): con las opciones de la versión que andaba en iPhone y, si algo falla, una mínima.
// tag = la clave del aviso: el mismo aviso repetido reemplaza al anterior en vez de apilarse.
self.addEventListener("push", (e) => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch {
    d = { titulo: "SIGNA", cuerpo: e.data ? e.data.text() : "" };
  }
  const titulo = d.titulo || "SIGNA";
  const url = d.url || d.enlace || "/avisos";
  const mostrar = self.registration
    .showNotification(titulo, {
      body: d.cuerpo || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: d.tag || undefined,
      data: { url },
    })
    .catch(() => self.registration.showNotification(titulo, { body: d.cuerpo || "", data: { url } }));
  // El dispositivo confirma que la recibió (diagnóstico). Nunca frena el aviso.
  const confirmar = self.registration.pushManager
    .getSubscription()
    .then((s) => s && fetch("/api/push/recibido", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: s.endpoint }) }))
    .catch(() => {});
  e.waitUntil(Promise.all([mostrar, confirmar]));
});

// Al tocar el aviso: si la app ya está abierta, se enfoca y va al enlace; si no, se abre en el enlace.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const datos = e.notification.data || {};
  const destino = new URL(datos.url || datos.enlace || "/avisos", self.location.origin).href;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (ventanas) => {
      const abierta = ventanas.find((v) => v.url.startsWith(self.location.origin));
      if (abierta) {
        await abierta.focus();
        if (abierta.url !== destino) return abierta.navigate(destino).catch(() => self.clients.openWindow(destino));
        return abierta;
      }
      return self.clients.openWindow(destino);
    }),
  );
});
