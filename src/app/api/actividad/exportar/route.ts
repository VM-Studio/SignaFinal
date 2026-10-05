import { NextResponse, type NextRequest } from "next/server";
import { obtenerSesion } from "@/lib/auth/sesion";
import { puede } from "@/lib/permisos";
import { db } from "@/lib/db";
import { auditar } from "@/lib/auditoria";
import { actividadParaExportar, TIPOS_ACCION, type TipoAccion } from "@/lib/actividad/consultas";
import { ROL } from "@/lib/etiquetas";
import { diaISO, hora } from "@/lib/formato";

const celda = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

/** CSV de la actividad con los mismos filtros de la pantalla (solo Dirección). */
export async function GET(req: NextRequest) {
  const u = await obtenerSesion();
  if (!u || !puede(u.rol, "actividad.ver")) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const q = req.nextUrl.searchParams;
  const tipo = q.get("tipo");
  const filas = await actividadParaExportar({
    persona: q.get("persona") || undefined, obra: q.get("obra") || undefined, q: q.get("q") || undefined,
    tipo: tipo && tipo in TIPOS_ACCION ? (tipo as TipoAccion) : undefined,
    desde: q.get("desde") || undefined, hasta: q.get("hasta") || undefined,
  });
  const csv = [
    ["Fecha", "Hora", "Persona", "Rol", "Qué hizo", "Acción", "IP"].map(celda).join(";"),
    ...filas.map((f) => [diaISO(f.fecha), hora(f.fecha), f.usuario?.nombre ?? "Sistema", f.rol ? ROL[f.rol] : "", f.resumen, f.accion, f.ip ?? ""].map(celda).join(";")),
  ].join("\r\n");
  await auditar(db, { usuarioId: u.id, accion: "costos.exportarActividad", entidad: "Auditoria", entidadId: "csv", resumen: `${u.nombre} exportó la actividad (${filas.length} filas)` });
  return new NextResponse("﻿" + csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="actividad-${diaISO()}.csv"` },
  });
}
