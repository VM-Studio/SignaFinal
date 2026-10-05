import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESION, verificar } from "@/lib/auth/jwt";
import { rutaNueva, rutaPermitida } from "@/lib/permisos";

/** Protege todo salvo /login y los estáticos. */
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const sesion = await verificar(req.cookies.get(COOKIE_SESION)?.value);
  const esLogin = pathname === "/login";

  if (!sesion && !esLogin) {
    const url = new URL("/login", req.url);
    if (pathname !== "/" && pathname !== "/inicio") url.searchParams.set("volver", pathname + search);
    return NextResponse.redirect(url);
  }
  if (esLogin && req.nextUrl.searchParams.has("salir")) {
    // Sesión que ya no sirve (usuario desactivado): se borra la cookie y se muestra el login.
    const r = NextResponse.redirect(new URL("/login", req.url));
    r.cookies.delete(COOKIE_SESION);
    return r;
  }
  if (sesion && esLogin) return NextResponse.redirect(new URL("/inicio", req.url));
  if (sesion && !esLogin) {
    if (pathname === "/") return NextResponse.redirect(new URL("/inicio", req.url));
    // Rutas de antes de la reorganización por rol.
    const nueva = rutaNueva(sesion.rol, pathname);
    if (nueva) return NextResponse.redirect(new URL(nueva + search, req.url));
    // Lo que no está en la matriz del rol no existe para él: a su inicio, sin mensaje.
    if (!rutaPermitida(sesion.rol, pathname)) return NextResponse.redirect(new URL("/inicio", req.url));
  }
  // El layout vuelve a controlar con el rol leído de la base (por si cambió desde que se firmó la sesión).
  const cabeceras = new Headers(req.headers);
  cabeceras.set("x-ruta", pathname);
  return NextResponse.next({ request: { headers: cabeceras } });
}

export const config = {
  // Fuera: API, estáticos de Next y cualquier archivo de public/ (imágenes, sw.js, manifest…).
  matcher: ["/((?!api/|_next/static|_next/image|icons/|img/|splash/|offline|.*\\.(?:png|jpe?g|svg|webp|ico|js|webmanifest|txt)$).*)"],
};
