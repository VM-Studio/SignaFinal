import ExcelJS from "exceljs";
import { esEncabezado, filaVacia, mapeoAutomatico, type Celda, type Mapeo } from "./importarTablero";

/**
 * Lee el .xlsx del tablero: busca la hoja (la que tiene "TABLERO" en el nombre, o cualquiera con los
 * encabezados) y la fila de encabezados ("N° OC / PE" y "SOLICITADO POR"); devuelve las filas de datos
 * crudas (fechas como AAAA-MM-DD, fórmulas por su resultado) para revisarlas en la vista previa.
 */
export type TableroLeido = { hoja: string; filaEncabezados: number; encabezados: Celda[]; mapeo: Mapeo; filas: { n: number; celdas: Celda[] }[] };

function valor(v: ExcelJS.CellValue): Celda {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number" || typeof v === "string") return v;
  if (typeof v === "boolean") return v ? "SÍ" : "NO";
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("result" in v) return valor((v as { result?: ExcelJS.CellValue }).result ?? null) ?? (("formula" in v && v.formula) ? `=${v.formula}` : null);
    if ("text" in v) return String((v as { text: unknown }).text ?? "");
    if ("error" in v) return null;
  }
  return String(v);
}

function filasDe(hoja: ExcelJS.Worksheet) {
  const filas: { n: number; celdas: Celda[] }[] = [];
  hoja.eachRow({ includeEmpty: false }, (fila, n) => {
    const celdas: Celda[] = [];
    fila.eachCell({ includeEmpty: true }, (c, col) => { celdas[col - 1] = valor(c.value); });
    for (let i = 0; i < celdas.length; i++) if (celdas[i] === undefined) celdas[i] = null;
    filas.push({ n, celdas });
  });
  return filas;
}

export async function leerTableroExcel(datos: ArrayBuffer | Buffer): Promise<TableroLeido | { error: string }> {
  const libro = new ExcelJS.Workbook();
  try {
    await libro.xlsx.load(datos as ArrayBuffer);
  } catch {
    return { error: "No se pudo leer el archivo. Tiene que ser un Excel .xlsx." };
  }
  const hojas = [...libro.worksheets].sort((a, b) => Number(/TABLERO/i.test(b.name)) - Number(/TABLERO/i.test(a.name)));
  for (const hoja of hojas) {
    // Las hojas de plantillas (miles de filas) no tienen el encabezado del tablero en las primeras 40.
    let enc: { n: number; celdas: Celda[] } | null = null;
    for (let n = 1; n <= Math.min(40, hoja.rowCount); n++) {
      const celdas: Celda[] = [];
      hoja.getRow(n).eachCell({ includeEmpty: true }, (c, col) => { celdas[col - 1] = valor(c.value); });
      if (esEncabezado(celdas)) { enc = { n, celdas }; break; }
    }
    if (!enc) continue;
    const mapeo = mapeoAutomatico(enc.celdas);
    const filas = filasDe(hoja).filter((f) => f.n > enc!.n && !filaVacia(f.celdas, mapeo));
    return { hoja: hoja.name, filaEncabezados: enc.n, encabezados: enc.celdas, mapeo, filas };
  }
  return { error: "No encontramos la hoja del tablero: tiene que tener una fila con “N° OC / PE” y “SOLICITADO POR”." };
}
