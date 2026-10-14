import { NextResponse } from "next/server";
import { z } from "zod";
import { obtenerSesion } from "@/lib/auth/sesion";
import { puede } from "@/lib/permisos";
import { revalidar } from "@/lib/revalidar";
import { importarFilas } from "@/lib/compras/importacion";
import { CAMPOS } from "@/lib/compras/importarTablero";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const celda = z.union([z.string().max(10_000), z.number(), z.null()]);
const esquema = z.object({
  filas: z.array(z.object({ n: z.number().int(), celdas: z.array(celda).max(60) })).max(20_000),
  mapeo: z.object(Object.fromEntries(CAMPOS.map((c) => [c.campo, z.number().int().min(0).max(59).nullable()])) as Record<string, z.ZodNullable<z.ZodNumber>>),
  correcciones: z.record(z.string(), z.object({
    excluir: z.boolean().optional(), tipo: z.enum(["OC", "PE"]).optional(), numero: z.string().max(20).optional(), fecha: z.string().max(10).optional(),
    obraId: z.string().nullable().optional(), estado: z.enum(["", "PEDIR_AUTORIZACION", "AUTORIZADA", "SOLICITUD_PRESUPUESTO", "ENCARGADO", "ENTREGADO", "ANULADA"]).optional(),
  })).default({}),
});

/** "Importar N filas válidas": vuelve a revisar todo en el servidor e importa (sin duplicar). */
export async function POST(req: Request) {
  const u = await obtenerSesion();
  if (!u || !puede(u.rol, "materiales.gestionar")) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const d = esquema.safeParse(await req.json().catch(() => null));
  if (!d.success) return NextResponse.json({ error: "Los datos de la importación no son válidos. Volvé a subir el archivo." }, { status: 400 });
  const correcciones = Object.fromEntries(Object.entries(d.data.correcciones).map(([k, v]) => [Number(k), v]));
  try {
    const resumen = await importarFilas(u, d.data.filas, d.data.mapeo as never, correcciones);
    revalidar("materiales");
    return NextResponse.json(resumen);
  } catch (e) {
    console.error("Importación del tablero", e);
    return NextResponse.json({ error: "No se pudo importar. No se guardó nada de la tanda que falló: probá de nuevo." }, { status: 500 });
  }
}
