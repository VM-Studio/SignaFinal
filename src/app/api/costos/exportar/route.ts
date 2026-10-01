import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { obtenerSesion } from "@/lib/auth/sesion";
import { puede } from "@/lib/permisos";
import { costosPorObra, costosPorVehiculo, periodo } from "@/lib/costos/consultas";

export const dynamic = "force-dynamic";

/** CSV para Excel en español y para cargar en Lebane: separador ";", coma decimal, BOM. */
function csv(encabezados: string[], filas: (string | number | null)[][]) {
  const celda = (v: string | number | null) => {
    if (v == null) return "";
    const t = typeof v === "number" ? (Number.isInteger(v) ? String(v) : v.toFixed(2)).replace(".", ",") : v;
    return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  return "﻿" + [encabezados, ...filas].map((f) => f.map(celda).join(";")).join("\r\n");
}

export async function GET(req: NextRequest) {
  const u = await obtenerSesion();
  if (!u) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  if (!puede(u.rol, "costos.exportar")) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const q = req.nextUrl.searchParams;
  const p = periodo({ desde: q.get("desde") ?? undefined, hasta: q.get("hasta") ?? undefined });
  const tipo = q.get("tipo") === "vehiculos" ? "vehiculos" : "obras";

  let contenido: string;
  if (tipo === "obras") {
    const filas = await costosPorObra(p);
    contenido = csv(
      ["Código de obra Lebane", "Código de obra", "Obra", "Desde", "Hasta", "Viajes", "Km", "Peajes", "Costo de viajes", "Combustible imputado", "Litros", "Total gasto"],
      filas.map((f) => [f.idLebane, f.codigo, f.obra, p.desdeISO, p.hastaISO, f.viajes, f.km, f.peajes, f.costoViajes, f.combustible, f.litros, f.total]),
    );
  } else {
    const filas = await costosPorVehiculo(p);
    contenido = csv(
      ["Vehículo", "Patente", "Desde", "Hasta", "Viajes", "Km", "Costo de viajes", "Combustible", "Litros", "Mantenimiento", "Incidentes", "Costo real", "Costo real por km"],
      filas.map((f) => [f.vehiculo, f.patente, p.desdeISO, p.hastaISO, f.viajes, f.km, f.costoViajes, f.combustible, f.litros, f.mantenimiento, f.incidentes, f.costoReal, f.costoPorKm]),
    );
  }

  await db.auditoria.create({ data: { usuarioId: u.id, accion: "costos.exportar", entidad: "Costos", entidadId: tipo, despues: { desde: p.desdeISO, hasta: p.hastaISO } } });
  return new NextResponse(contenido, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="signa-costos-${tipo}-${p.desdeISO}_${p.hastaISO}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
