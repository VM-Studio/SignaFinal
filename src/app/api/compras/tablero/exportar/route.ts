import { PassThrough, Readable } from "node:stream";
import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { obtenerSesion } from "@/lib/auth/sesion";
import { puede } from "@/lib/permisos";
import { filasParaExportar, leerFiltros } from "@/lib/compras/tablero";
import { ESTADO_TABLERO } from "@/lib/compras/estadoTablero";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Exportar el tablero a Excel con las MISMAS columnas, en el mismo orden y con los mismos títulos de la
 * fila 9 de la planilla de Alejandra (el archivo exportado es su tablero), con los filtros de la
 * pantalla. Se escribe en streaming (tandas de 500 filas): no carga miles de órdenes en memoria.
 */
const COLUMNAS = [
  { header: "OC/PE", key: "tipo", width: 7 },
  { header: "N° OC / PE", key: "numero", width: 11 },
  { header: "FECHA", key: "fecha", width: 12, style: { numFmt: "dd/mm/yyyy" } },
  { header: "SOLICITADO POR", key: "solicitadoPor", width: 18 },
  { header: "OBRA", key: "obra", width: 22 },
  { header: "PROVEEDOR", key: "proveedor", width: 26 },
  { header: "IMPORTE", key: "importe", width: 16, style: { numFmt: '"$" #,##0.00' } },
  { header: "DESCRIPCION / MATERIALES", key: "materiales", width: 60, style: { alignment: { wrapText: true, vertical: "top" as const } } },
  { header: "ESTADO", key: "estado", width: 22 },
  { header: "FECHA DE ENTREGA", key: "fechaEntrega", width: 14, style: { numFmt: "dd/mm/yyyy" } },
  { header: "Observaciones en OC / Próximos Pasos", key: "proximosPasos", width: 50, style: { alignment: { wrapText: true, vertical: "top" as const } } },
  { header: "Comentarios", key: "comentarios", width: 40, style: { alignment: { wrapText: true, vertical: "top" as const } } },
];

const fecha = (s: string | null) => (s ? new Date(`${s}T12:00:00Z`) : null);

export async function GET(req: Request) {
  const u = await obtenerSesion();
  if (!u || !(puede(u.rol, "materiales.gestionar") || puede(u.rol, "materiales.aprobar") || u.rol === "ADMINISTRACION")) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const f = leerFiltros(Object.fromEntries(new URL(req.url).searchParams));
  const salida = new PassThrough();
  const libro = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: salida, useStyles: true });
  const hoja = libro.addWorksheet("TABLERO DE CONTROL ORDENES DE C", { views: [{ state: "frozen", ySplit: 1 }] });
  hoja.columns = COLUMNAS;
  hoja.getRow(1).font = { bold: true };
  hoja.getRow(1).commit();

  (async () => {
    try {
      for await (const x of filasParaExportar(f)) {
        hoja.addRow({
          tipo: x.tipo, numero: /^\d+$/.test(x.numero) ? Number(x.numero) : x.numero, fecha: fecha(x.fecha), solicitadoPor: x.solicitadoPor.toUpperCase(), obra: x.obra.toUpperCase(),
          proveedor: (x.proveedor ?? x.proveedorSugerido ?? "").toUpperCase(),
          importe: x.importe ?? (x.importeAConfirmar ? "A CONFIRMAR" : null),
          materiales: x.materiales, estado: x.estado ? ESTADO_TABLERO[x.estado].excel : "", fechaEntrega: fecha(x.fechaEntrega),
          proximosPasos: x.proximosPasos ?? "", comentarios: x.comentarios ?? "",
        }).commit();
      }
      hoja.commit();
      await libro.commit();
    } catch (e) {
      console.error("No se pudo exportar el tablero", e);
      salida.destroy(e as Error);
    }
  })();

  const nombre = `tablero-compras-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(Readable.toWeb(salida) as ReadableStream, {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${nombre}"`, "Cache-Control": "no-store" },
  });
}
