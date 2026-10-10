import { NextResponse } from "next/server";
import { obtenerSesion } from "@/lib/auth/sesion";
import { puede } from "@/lib/permisos";
import { ordenesParaExportar } from "@/lib/compras/consultas";
import { ESTADO_OC, METODO_PAGO } from "@/lib/compras/estados";

const celda = (v: unknown) => {
  const t = v == null ? "" : String(v);
  return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

/** CSV de las órdenes de compra (los mismos filtros de la pantalla), un renglón de material por fila. */
export async function GET(req: Request) {
  const u = await obtenerSesion();
  if (!u || !puede(u.rol, "materiales.gestionar")) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const p = new URL(req.url).searchParams;
  const ocs = await ordenesParaExportar({ q: p.get("q") ?? undefined, estado: p.get("estado") ?? undefined, desde: p.get("desde") ?? undefined, hasta: p.get("hasta") ?? undefined });
  const filas = [["Número", "Fecha", "Estado", "Proveedor", "Sucursal", "Obra", "Solicitante", "Fecha necesaria", "Método de pago", "Moneda", "Condiciones", "Renglón", "Descripción", "Cantidad", "Unidad", "Precio unitario", "Subtotal renglón", "Subtotal OC", "IVA", "Total OC", "Aprobó", "Aprobada el", "Observaciones"]];
  for (const o of ocs) {
    const base = [o.numero ?? "", o.fecha, ESTADO_OC[o.estado].titulo, o.proveedor ?? "", o.sucursal?.nombre ?? "", o.obra, o.solicitante, o.fechaNecesaria ?? "", o.metodoPago ? METODO_PAGO[o.metodoPago] : "", o.moneda, o.condiciones ?? ""];
    const pie = [o.subtotal ?? "", o.iva ?? "", o.total ?? "", o.aprobadaPor ?? "", o.aprobadaEn?.slice(0, 10) ?? "", o.observaciones ?? ""];
    if (!o.renglones.length) filas.push([...base, "", "", "", "", "", "", ...pie].map(String));
    o.renglones.forEach((r, i) => filas.push([...base, i + 1, r.descripcion, String(r.cantidad).replace(".", ","), r.unidad, r.precioUnitario ?? "", r.subtotal ?? "", ...pie].map((x) => String(x))));
  }
  const csv = "﻿" + filas.map((f) => f.map(celda).join(";")).join("\r\n");
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="ordenes-de-compra-${new Date().toISOString().slice(0, 10)}.csv"` } });
}
