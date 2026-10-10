import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import type { EntidadAdjunto } from "@prisma/client";
import { obtenerSesion } from "@/lib/auth/sesion";
import { MAX_ADJUNTO_BYTES, SIN_ALMACENAMIENTO, TIPOS_ADJUNTO } from "@/lib/archivos";
import { puedeSubir } from "@/lib/adjuntos/permisos";

/** Token para que el navegador suba directo a Blob los archivos grandes (hasta 20 MB). */
export async function POST(req: Request) {
  const u = await obtenerSesion();
  if (!u) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ error: SIN_ALMACENAMIENTO }, { status: 503 });
  const body = (await req.json()) as HandleUploadBody;
  try {
    const r = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (_pathname, payload) => {
        const p = JSON.parse(payload ?? "{}") as { entidadTipo?: EntidadAdjunto; interno?: boolean };
        if (!p.entidadTipo || !puedeSubir(u, p.entidadTipo, !!p.interno)) throw new Error("No podés adjuntar archivos acá.");
        return { allowedContentTypes: [...new Set(Object.values(TIPOS_ADJUNTO))], maximumSizeInBytes: MAX_ADJUNTO_BYTES, addRandomSuffix: true, tokenPayload: u.id };
      },
    });
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo preparar la subida." }, { status: 400 });
  }
}

