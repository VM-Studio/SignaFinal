import { NextResponse, type NextRequest } from "next/server";
import { format } from "date-fns";
import { db } from "@/lib/db";
import { obtenerUsuarioActual } from "@/lib/auth/usuario-actual";
import { puede } from "@/lib/permisos";
import { costosPorObra, costosPorVehiculo, periodoDesdeParams, viajesDelPeriodo } from "@/lib/datos/costos";
import { auditar } from "@/lib/auditoria";
import { TIPO_MANTENIMIENTO } from "@/lib/etiquetas";

export const dynamic = "force-dynamic";

/** CSV para Excel en español: separador ";" , coma decimal y BOM para los acentos. */
function csv(encabezados: string[], filas: (string | number | null | undefined)[][]) {
  const celda = (v: string | number | null | undefined) => {
    if (v == null) return "";
    const t = typeof v === "number" ? String(v).replace(".", ",") : v;
    return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  return "﻿" + [encabezados, ...filas].map((f) => f.map(celda).join(";")).join("\r\n");
}

const f = (d: Date | null) => (d ? format(d, "dd/MM/yyyy HH:mm") : "");

export async function GET(req: NextRequest, { params }: { params: Promise<{ tipo: string }> }) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  if (!puede(usuario.rol, "costos.exportar")) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const { tipo } = await params;
  const periodo = periodoDesdeParams(Object.fromEntries(req.nextUrl.searchParams));
  const sufijo = `${format(periodo.desde, "yyyy-MM-dd")}_${format(periodo.hasta, "yyyy-MM-dd")}`;
  let contenido: string;

  switch (tipo) {
    case "viajes": {
      const viajes = await viajesDelPeriodo(periodo);
      contenido = csv(
        ["Pedido", "Salida", "Llegada", "Obra", "Desde", "OC", "Qué", "Chofer", "Vehículo", "Km salida", "Km llegada", "Km", "Costo por km", "Peajes", "Costo"],
        viajes.map((v) => [v.pedido.numero, f(v.salidaEn), f(v.llegadaEn), v.obra.nombre, v.origen, v.pedido.ordenCompra?.numero, v.pedido.descripcion, v.chofer.nombre, v.vehiculo.nombre, v.kmSalida, v.kmLlegada, v.kmRecorridos, v.costoKmAplicado, v.peajes, v.costo]),
      );
      break;
    }
    case "obras": {
      const filas = await costosPorObra(periodo);
      contenido = csv(["Obra", "Viajes", "Km", "Peajes", "Costo"], filas.map((o) => [o.obra, o.viajes, o.km, o.peajes, o.costo]));
      break;
    }
    case "vehiculos": {
      const filas = await costosPorVehiculo(periodo);
      contenido = csv(
        ["Vehículo", "Viajes", "Km", "Costo viajes", "Litros", "Combustible", "Mantenimiento"],
        filas.map((v) => [v.vehiculo, v.viajes, v.km, v.costoViajes, v.litros, v.combustible, v.mantenimiento]),
      );
      break;
    }
    case "combustible": {
      const cargas = await db.cargaCombustible.findMany({
        where: { fecha: { gte: periodo.desde, lte: periodo.hasta } },
        orderBy: { fecha: "desc" },
        include: { vehiculo: { select: { nombre: true, patente: true } }, chofer: { select: { nombre: true } } },
      });
      contenido = csv(
        ["Fecha", "Vehículo", "Patente", "Cargó", "Litros", "Monto", "Km"],
        cargas.map((c) => [f(c.fecha), c.vehiculo.nombre, c.vehiculo.patente, c.chofer.nombre, Number(c.litros), Number(c.monto), c.km]),
      );
      break;
    }
    case "mantenimiento": {
      const m = await db.mantenimiento.findMany({
        where: { fecha: { gte: periodo.desde, lte: periodo.hasta } },
        orderBy: { fecha: "desc" },
        include: { vehiculo: { select: { nombre: true, patente: true } } },
      });
      contenido = csv(
        ["Fecha", "Vehículo", "Patente", "Tipo", "Detalle", "Km", "Taller", "Costo"],
        m.map((x) => [format(x.fecha, "dd/MM/yyyy"), x.vehiculo.nombre, x.vehiculo.patente, TIPO_MANTENIMIENTO[x.tipo], x.descripcion, x.km, x.taller, Number(x.costo)]),
      );
      break;
    }
    default:
      return NextResponse.json({ error: "Exportación desconocida" }, { status: 404 });
  }

  await auditar(db, { usuarioId: usuario.id, accion: "exportar", entidad: "Exportacion", entidadId: tipo, detalle: { desde: periodo.desde.toISOString(), hasta: periodo.hasta.toISOString() } });
  return new NextResponse(contenido, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="signa-${tipo}-${sufijo}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
