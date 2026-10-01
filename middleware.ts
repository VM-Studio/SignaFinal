import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESION, verificarSesion } from "@/lib/auth/sesion";

const PUBLICAS = ["/login", "/offline"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const sesion = await verificarSesion(req.cookies.get(COOKIE_SESION)?.value);
  const esPublica = PUBLICAS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!sesion && !esPublica) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" || pathname === "/inicio" ? "" : `?volver=${encodeURIComponent(pathname + req.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  if (sesion && pathname === "/login") {
    return NextResponse.redirect(new URL("/inicio", req.url));
  }
  return NextResponse.next();
}

export const config = {
  // Todo menos estáticos, API (se protege sola) y archivos de la PWA.
  matcher: ["/((?!api|_next/static|_next/image|img|icons|sw.js|manifest.webmanifest|icon.png|apple-icon.png|favicon.ico).*)"],
};
