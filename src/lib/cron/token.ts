import "server-only";
import type { NextRequest } from "next/server";

/** Las rutas de cron se protegen con CRON_SECRET: "Authorization: Bearer …" (Vercel Cron) o ?token=. */
export function tokenValido(req: NextRequest) {
  const s = process.env.CRON_SECRET;
  if (!s) return false;
  return req.headers.get("authorization") === `Bearer ${s}` || req.nextUrl.searchParams.get("token") === s;
}
