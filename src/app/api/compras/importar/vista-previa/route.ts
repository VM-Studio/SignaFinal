import { NextResponse } from "next/server";
import { obtenerSesion } from "@/lib/auth/sesion";
import { puede } from "@/lib/permisos";
import { leerTableroExcel } from "@/lib/compras/leerTablero";
import { catalogosImportacion, existentes } from "@/lib/compras/importacion";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Sube el .xlsx y devuelve las filas detectadas + lo que hay en el sistema para emparejar (no guarda nada). */
export async function POST(req: Request) {
  const u = await obtenerSesion();
  if (!u || !puede(u.rol, "materiales.gestionar")) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const form = await req.formData().catch(() => null);
  const archivo = form?.get("archivo");
  if (!(archivo instanceof File)) return NextResponse.json({ error: "Elegí el archivo .xlsx." }, { status: 400 });
  if (!/\.xlsx$/i.test(archivo.name)) return NextResponse.json({ error: "Tiene que ser un Excel .xlsx (si es .xls, guardalo como .xlsx)." }, { status: 400 });
  if (archivo.size > 20 * 1024 * 1024) return NextResponse.json({ error: "El archivo pesa más de 20 MB." }, { status: 400 });
  const leido = await leerTableroExcel(Buffer.from(await archivo.arrayBuffer()));
  if ("error" in leido) return NextResponse.json({ error: leido.error }, { status: 400 });
  const [catalogos, ya] = await Promise.all([catalogosImportacion(), existentes()]);
  return NextResponse.json({ archivo: archivo.name, ...leido, catalogos, existentes: ya });
}
