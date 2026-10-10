import { NextResponse } from "next/server";
import { z } from "zod";
import { obtenerSesion } from "@/lib/auth/sesion";
import { puede } from "@/lib/permisos";
import { pdfVistaPrevia } from "@/lib/compras/servicio";

const num = z.preprocess((v) => (v === "" || v == null ? null : typeof v === "string" ? Number(v.replace(/\./g, "").replace(",", ".")) : v), z.number().nullable());
const esquema = z.object({
  pedidoMaterialId: z.string().min(1),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fechaNecesaria: z.string().nullable().optional(),
  sucursalId: z.string().nullable().optional(),
  metodoPago: z.enum(["ACOPIO", "CUENTA_CORRIENTE", "TRANSFERENCIA", "EFECTIVO", "ECHEQ"]).nullable().optional(),
  moneda: z.enum(["ARS", "USD"]).optional(),
  condiciones: z.string().max(300).nullable().optional(),
  observaciones: z.string().max(1500).nullable().optional(),
  ivaPorcentaje: num.optional(),
  renglones: z.array(z.object({ descripcion: z.string().max(200), cantidad: num, unidad: z.string().max(20), precioUnitario: num })).max(200),
});

/** "Vista previa del PDF": lo genera con lo que hay en el formulario, con marca BORRADOR y sin número. */
export async function POST(req: Request) {
  const u = await obtenerSesion();
  if (!u || !puede(u.rol, "materiales.gestionar")) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const d = esquema.safeParse(await req.json().catch(() => null));
  if (!d.success) return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  const pdf = await pdfVistaPrevia({ ...d.data, renglones: d.data.renglones.map((r) => ({ ...r, cantidad: r.cantidad ?? 0 })), creadaPor: u.nombre });
  return new NextResponse(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Cache-Control": "no-store" } });
}
