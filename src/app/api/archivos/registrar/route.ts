import { NextResponse } from "next/server";
import { z } from "zod";
import { obtenerSesion } from "@/lib/auth/sesion";
import { ErrorNegocio } from "@/lib/resultado";
import { registrarAdjunto, validarArchivo } from "@/lib/archivos";
import { puedeSubir } from "@/lib/adjuntos/permisos";

const esquema = z.object({
  url: z.string().url(),
  nombre: z.string().min(1).max(200),
  tamano: z.number().int().positive(),
  tipo: z.string().optional(),
  entidadTipo: z.enum(["PEDIDO_MATERIAL", "ORDEN_COMPRA", "VIAJE", "HERRAMIENTA", "VEHICULO"]),
  interno: z.boolean().optional(),
});

/** Después de una subida directa a Blob: crea el Adjunto (solo con URLs del store de Blob). */
export async function POST(req: Request) {
  const u = await obtenerSesion();
  if (!u) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  const d = esquema.safeParse(await req.json().catch(() => null));
  if (!d.success) return NextResponse.json({ error: "Datos del archivo incompletos." }, { status: 400 });
  if (!new URL(d.data.url).hostname.endsWith(".blob.vercel-storage.com")) return NextResponse.json({ error: "Esa URL no es del almacenamiento." }, { status: 400 });
  if (!puedeSubir(u, d.data.entidadTipo, !!d.data.interno)) return NextResponse.json({ error: "No podés adjuntar archivos acá." }, { status: 403 });
  try {
    const tipo = validarArchivo(d.data.nombre, d.data.tamano, d.data.tipo);
    const a = await registrarAdjunto({ entidadTipo: d.data.entidadTipo, nombre: d.data.nombre, url: d.data.url, tipoMime: tipo, tamanoBytes: d.data.tamano, subidoPorId: u.id, interno: d.data.interno });
    return NextResponse.json({ adjuntos: [a] });
  } catch (e) {
    return NextResponse.json({ error: e instanceof ErrorNegocio ? e.message : "No se pudo registrar el archivo." }, { status: 400 });
  }
}
