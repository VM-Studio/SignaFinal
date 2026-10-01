import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESION, verificar } from "@/lib/auth/jwt";

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
  if (sesion && esLogin) return NextResponse.redirect(new URL("/inicio", req.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icons|img|signalogo.png|manifest.webmanifest|icon.png|apple-icon.png|favicon.ico|robots.txt).*)"],
};
