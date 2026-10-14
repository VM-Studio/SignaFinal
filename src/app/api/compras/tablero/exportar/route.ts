import { PassThrough, Readable } from "node:stream";
import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { obtenerSesion } from "@/lib/auth/sesion";
import { puede } from "@/lib/permisos";
import { filasParaExportar, leerFiltros } from "@/lib/compras/tablero";
import { ESTADO_TABLERO, PLANILLA_TABLERO } from "@/lib/compras/estadoTablero";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Exportar el tablero a Excel como SU planilla: la franja "Planilla de control COMPRAS" (rosa, itálica),
 * el encabezado gris con las MISMAS columnas, títulos y orden de la fila 9 (más la Nº con el código de su
 * leyenda), la columna Nº y el ESTADO pintados del color de cada estado, "A CONFIRMAR" en amarillo como sus
 * "????", grilla completa y texto con saltos de línea. Con los filtros de la pantalla. Se escribe en
 * streaming (tandas de 500 filas): no carga miles de órdenes en memoria. Se puede volver a importar.
 */
const centro = { horizontal: "center" as const, vertical: "middle" as const, wrapText: true };
const texto = { horizontal: "left" as const, vertical: "top" as const, wrapText: true };
const COLUMNAS = [
  { header: "Nº", key: "codigo", width: 5, style: { alignment: centro } },
  { header: "OC/PE", key: "tipo", width: 7, style: { alignment: centro } },
  { header: "N° OC / PE", key: "numero", width: 10, style: { alignment: centro } },
  { header: "FECHA", key: "fecha", width: 12, style: { numFmt: "d/m/yyyy", alignment: centro } },
  { header: "SOLICITADO POR", key: "solicitadoPor", width: 16, style: { alignment: centro } },
  { header: "OBRA", key: "obra", width: 20, style: { alignment: centro } },
  { header: "PROVEEDOR", key: "proveedor", width: 26, style: { alignment: centro } },
  { header: "IMPORTE", key: "importe", width: 17, style: { numFmt: '"$" #,##0.00', alignment: { ...centro, horizontal: "right" as const } } },
  { header: "DESCRIPCION / MATERIALES", key: "materiales", width: 58, style: { alignment: texto } },
  { header: "ESTADO", key: "estado", width: 24, style: { alignment: centro } },
  { header: "FECHA DE ENTREGA", key: "fechaEntrega", width: 14, style: { numFmt: "d/m/yyyy", alignment: centro } },
  { header: "Observaciones en OC / Próximos Pasos", key: "proximosPasos", width: 55, style: { alignment: texto } },
  { header: "Comentarios", key: "comentarios", width: 30, style: { alignment: texto } },
];

const fecha = (s: string | null) => (s ? new Date(`${s}T12:00:00Z`) : null);
const argb = (hex: string) => `FF${hex.replace("#", "").toUpperCase()}`;
const relleno = (hex: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb: argb(hex) } });
const borde = (hex: string): Partial<ExcelJS.Borders> => {
  const b = { style: "thin" as const, color: { argb: argb(hex) } };
  return { top: b, left: b, bottom: b, right: b };
};

export async function GET(req: Request) {
  const u = await obtenerSesion();
  if (!u || !(puede(u.rol, "materiales.gestionar") || puede(u.rol, "materiales.aprobar") || u.rol === "ADMINISTRACION")) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const f = leerFiltros(Object.fromEntries(new URL(req.url).searchParams));
  const nombre = u.rol === "COMPRAS" ? u.nombre.split(" ")[0] : "Alejandra";
  const salida = new PassThrough();
  const libro = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: salida, useStyles: true });
  const hoja = libro.addWorksheet("TABLERO DE CONTROL ORDENES DE C", { views: [{ state: "frozen", ySplit: 2, xSplit: 3 }] });
  hoja.columns = COLUMNAS;
  // Fila 1: la franja de título de su planilla. Fila 2: el encabezado (ExcelJS lo pone en la 1; se reescribe).
  const titulo = hoja.getRow(1);
  titulo.values = [`Planilla de control COMPRAS - ${nombre}`];
  titulo.height = 26;
  titulo.getCell(1).font = { italic: true, size: 15 };
  titulo.getCell(1).alignment = { horizontal: "left", vertical: "middle" };
  for (let c = 1; c <= COLUMNAS.length; c++) titulo.getCell(c).fill = relleno("#F2DCDB");
  titulo.commit();
  const encabezado = hoja.getRow(2);
  encabezado.values = COLUMNAS.map((c) => c.header);
  encabezado.height = 32;
  encabezado.eachCell((c) => {
    c.font = { bold: true, size: 11, color: { argb: "FF000000" } };
    c.fill = relleno("#D9D9D9");
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border = borde("#A6A6A6");
  });
  encabezado.commit();

  (async () => {
    try {
      for await (const x of filasParaExportar(f)) {
        const p = x.estado ? PLANILLA_TABLERO[x.estado] : null;
        const aConfirmar = x.importe == null && x.importeAConfirmar;
        const fila = hoja.addRow({
          codigo: p?.codigo ?? null,
          tipo: x.tipo, numero: /^\d+$/.test(x.numero) ? Number(x.numero) : x.numero, fecha: fecha(x.fecha), solicitadoPor: x.solicitadoPor.toUpperCase(), obra: x.obra.toUpperCase(),
          proveedor: (x.proveedor ?? x.proveedorSugerido ?? "").toUpperCase(),
          importe: x.importe ?? (aConfirmar ? "A CONFIRMAR" : null),
          materiales: x.materiales, estado: x.estado ? ESTADO_TABLERO[x.estado].excel : "", fechaEntrega: fecha(x.fechaEntrega),
          proximosPasos: x.proximosPasos ?? "", comentarios: x.comentarios ?? "",
        });
        for (let c = 1; c <= COLUMNAS.length; c++) fila.getCell(c).border = borde("#BFBFBF");
        if (p) {
          for (const c of [1, 10]) {
            fila.getCell(c).fill = relleno(p.fondo);
            fila.getCell(c).font = { bold: c === 10, color: { argb: argb(p.texto) }, strike: c === 1 && x.estado === "ANULADA" };
          }
        }
        if (aConfirmar) fila.getCell(8).fill = relleno("#FFFF00");
        fila.commit();
      }
      hoja.commit();
      await libro.commit();
    } catch (e) {
      console.error("No se pudo exportar el tablero", e);
      salida.destroy(e as Error);
    }
  })();

  const archivo = `tablero-compras-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(Readable.toWeb(salida) as ReadableStream, {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${archivo}"`, "Cache-Control": "no-store" },
  });
}
