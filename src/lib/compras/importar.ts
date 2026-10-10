import ExcelJS from "exceljs";

/**
 * Importa renglones (descripción, cantidad, unidad) de la planilla que adjuntó el que pidió, para no
 * transcribirla a mano en la OC. Es solo una AYUDA para cargar la tabla: Compras ve la vista previa y
 * confirma; la OC se arma con lo que queda en el formulario (los datos son la fuente, nunca el archivo).
 *
 * Lee .xlsx y .csv (; o ,). Busca la fila de encabezados (descripción / material / detalle, cantidad /
 * cant, unidad / u / um); si no la encuentra, toma la primera columna de texto y la primera de números.
 */
export type RenglonImportado = { descripcion: string; cantidad: number | null; unidad: string };
export type Importacion = { ok: true; renglones: RenglonImportado[]; hoja: string | null } | { ok: false; motivo: string };

const sinAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const ES_DESC = /^(descripcion|material(es)?|detalle|producto|item|articulo|concepto)$/;
const ES_CANT = /^(cantidad|cant\.?|cantidades|qty|cant)$/;
const ES_UNID = /^(unidad|unidades|u\.?|um|u\.m\.?|medida)$/;

/** "1.250,5" → 1250.5 · "40" → 40 · "40 bolsas" → 40. */
export function aNumero(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (v == null) return null;
  const t = String(v).trim().match(/^-?[\d.,]+/)?.[0];
  if (!t) return null;
  const normal = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : /^\d{1,3}(\.\d{3})+$/.test(t) ? t.replace(/\./g, "") : t;
  const n = Number(normal);
  return Number.isFinite(n) ? n : null;
}

const texto = (v: unknown): string => {
  if (v == null) return "";
  if (typeof v === "object" && v && "richText" in v) return (v as { richText: { text: string }[] }).richText.map((r) => r.text).join("");
  if (typeof v === "object" && v && "result" in v) return String((v as { result: unknown }).result ?? "");
  if (typeof v === "object" && v && "text" in v) return String((v as { text: unknown }).text ?? "");
  return String(v);
};

/** De una grilla (filas de celdas) a renglones. Pura: la prueban los tests. */
export function renglonesDeGrilla(filas: unknown[][]): RenglonImportado[] {
  const limpias = filas.map((f) => f.map((c) => (typeof c === "number" ? c : texto(c).trim()))).filter((f) => f.some((c) => c !== "" && c != null));
  if (!limpias.length) return [];
  // Encabezados en alguna de las primeras 10 filas.
  let col = { desc: -1, cant: -1, unid: -1 };
  let desde = 0;
  for (let i = 0; i < Math.min(10, limpias.length); i++) {
    const nombres = limpias[i].map((c) => sinAcentos(String(c)));
    const d = nombres.findIndex((n) => ES_DESC.test(n));
    if (d >= 0) {
      col = { desc: d, cant: nombres.findIndex((n) => ES_CANT.test(n)), unid: nombres.findIndex((n) => ES_UNID.test(n)) };
      desde = i + 1;
      break;
    }
  }
  if (col.desc < 0) {
    // Sin encabezados: la primera columna con texto y la primera con números.
    const muestra = limpias.slice(0, 20);
    const ancho = Math.max(...muestra.map((f) => f.length));
    const esNum = (j: number) => muestra.filter((f) => aNumero(f[j]) != null).length;
    const esTxt = (j: number) => muestra.filter((f) => typeof f[j] === "string" && f[j] !== "" && aNumero(f[j]) == null).length;
    const cols = Array.from({ length: ancho }, (_, j) => j);
    col.desc = cols.sort((a, b) => esTxt(b) - esTxt(a))[0];
    col.cant = cols.filter((j) => j !== col.desc).sort((a, b) => esNum(b) - esNum(a))[0] ?? -1;
    col.unid = -1;
  }
  const out: RenglonImportado[] = [];
  for (const f of limpias.slice(desde)) {
    const descripcion = String(f[col.desc] ?? "").trim();
    if (!descripcion || /^total(es)?$/i.test(descripcion)) continue;
    const cantidad = col.cant >= 0 ? aNumero(f[col.cant]) : null;
    // "40 bolsas" en la celda de cantidad: la unidad sale de ahí si no hay columna de unidad.
    const unidad = col.unid >= 0 ? String(f[col.unid] ?? "").trim() : col.cant >= 0 ? String(f[col.cant] ?? "").replace(/^-?[\d.,]+\s*/, "").trim() : "";
    out.push({ descripcion: descripcion.slice(0, 200), cantidad: cantidad != null && cantidad > 0 ? cantidad : null, unidad: (unidad || "u").slice(0, 20) });
  }
  return out.slice(0, 200);
}

function grillaCSV(contenido: string): string[][] {
  const lineas = contenido.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  const sep = (lineas[0]?.split(";").length ?? 0) > (lineas[0]?.split(",").length ?? 0) ? ";" : ",";
  return lineas.map((l) => {
    const celdas: string[] = [];
    let actual = "";
    let comillas = false;
    for (const ch of l) {
      if (ch === '"') comillas = !comillas;
      else if (ch === sep && !comillas) { celdas.push(actual); actual = ""; }
      else actual += ch;
    }
    celdas.push(actual);
    return celdas;
  });
}

/** Lee una planilla adjunta (por su nombre sabe el formato). */
export async function leerPlanilla(datos: Buffer, nombre: string): Promise<Importacion> {
  const ext = nombre.toLowerCase().split(".").pop();
  try {
    if (ext === "csv") {
      const renglones = renglonesDeGrilla(grillaCSV(datos.toString("utf8")));
      return renglones.length ? { ok: true, renglones, hoja: null } : { ok: false, motivo: "La planilla no tiene renglones con descripción." };
    }
    if (ext === "xlsx") {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(datos as unknown as ArrayBuffer);
      for (const hoja of wb.worksheets) {
        const filas: unknown[][] = [];
        hoja.eachRow({ includeEmpty: false }, (fila) => filas.push((fila.values as unknown[]).slice(1)));
        const renglones = renglonesDeGrilla(filas);
        if (renglones.length) return { ok: true, renglones, hoja: hoja.name };
      }
      return { ok: false, motivo: "No encontramos renglones con descripción en ninguna hoja." };
    }
    if (ext === "xls") return { ok: false, motivo: "Es un Excel viejo (.xls): no se puede leer. Guardalo como .xlsx o cargá los renglones a mano." };
    return { ok: false, motivo: "Solo se importan planillas Excel (.xlsx) o CSV. Cargá los renglones a mano mirando el archivo." };
  } catch {
    return { ok: false, motivo: "No se pudo leer la planilla. Cargá los renglones a mano mirando el archivo." };
  }
}
