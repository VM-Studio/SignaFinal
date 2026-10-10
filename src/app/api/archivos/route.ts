import { NextResponse } from "next/server";
import type { EntidadAdjunto } from "@prisma/client";
import { obtenerSesion } from "@/lib/auth/sesion";
import { ErrorNegocio } from "@/lib/resultado";
import { CARPETAS, MAX_POR_SERVIDOR_BYTES, registrarAdjunto, subir } from "@/lib/archivos";
import { puedeSubir } from "@/lib/adjuntos/permisos";

const ENTIDADES: EntidadAdjunto[] = ["PEDIDO_MATERIAL", "ORDEN_COMPRA", "VIAJE", "HERRAMIENTA", "VEHICULO"];

/**
 * Sube uno o varios archivos (multipart: "archivo", "entidadTipo", "interno") y devuelve los Adjunto
 * creados, todavía sin entidad: se enganchan al confirmar el formulario. Archivos de más de 4 MB van
 * directo a Blob desde el navegador (/api/archivos/token + /api/archivos/registrar).
 */
export async function POST(req: Request) {
  const u = await obtenerSesion();
  if (!u) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "No llegó ningún archivo." }, { status: 400 });
  }
  const entidadTipo = String(form.get("entidadTipo") ?? "") as EntidadAdjunto;
  const interno = form.get("interno") === "1";
  if (!ENTIDADES.includes(entidadTipo)) return NextResponse.json({ error: "Falta a qué pertenece el archivo." }, { status: 400 });
  if (!puedeSubir(u, entidadTipo, interno)) return NextResponse.json({ error: "No podés adjuntar archivos acá." }, { status: 403 });
  const archivos = form.getAll("archivo").filter((x): x is File => x instanceof File);
  if (!archivos.length) return NextResponse.json({ error: "No llegó ningún archivo." }, { status: 400 });
  try {
    const creados = [];
    for (const f of archivos) {
      if (f.size > MAX_POR_SERVIDOR_BYTES && process.env.VERCEL) throw new ErrorNegocio(`"${f.name}" es grande: se sube directo (probá de nuevo).`);
      const r = await subir({ nombre: f.name, tipo: f.type, datos: f }, CARPETAS[entidadTipo], u.id);
      creados.push(await registrarAdjunto({ entidadTipo, nombre: f.name, url: r.url, tipoMime: r.tipo, tamanoBytes: r.tamano, subidoPorId: u.id, interno }));
    }
    return NextResponse.json({ adjuntos: creados });
  } catch (e) {
    const mensaje = e instanceof ErrorNegocio ? e.message : "No se pudo subir el archivo. Probá de nuevo.";
    if (!(e instanceof ErrorNegocio)) console.error("Subida de archivo", e);
    return NextResponse.json({ error: mensaje }, { status: e instanceof ErrorNegocio ? 400 : 500 });
  }
}
