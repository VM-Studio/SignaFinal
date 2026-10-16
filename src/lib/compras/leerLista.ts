import ExcelJS from "exceljs";
import { valor } from "./leerTablero";
import { unidadDe } from "./renglones";

/**
 * LISTA DE MATERIALES EN EXCEL → "DETALLE DEL PEDIDO". Lee un .xlsx adjunto (solo Excel: es lo único que se lee
 * completo y sin adivinar) y devuelve un renglón por material con su cantidad y unidad. Busca en las primeras
 * filas el encabezado ("Descripción" / "Material" / "Detalle" + "Cantidad" y/o "Unidad"); si la hoja no tiene
 * encabezado, toma cada fila con un texto y un número (el número a la derecha del texto: "Cemento | 40 | bolsas").
 * Los títulos de sección (sin cantidad, debajo de un encabezado) quedan como línea sin cantidad. Las filas de
 * totales y observaciones se saltean. Usa la primera hoja visible que tenga materiales.
 */
export type RenglonLista = { descripcion: string; cantidad: number | null; unidad: string | null };

const MAX_RENGLONES = 300;

const normal = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[.:]+$/, "").replace(/\s+/g, " ").trim();
const texto = (s: unknown) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim() : typeof s === "number" ? String(s) : "");

const DESCRIPCION: RegExp[] = [/^descripcion/, /^materiales?\b/, /^detalle/, /^(articulo|producto|concepto|insumo|denominacion|designacion)s?\b/, /^(item|nombre)$/];
const CANTIDAD = /^(cant(idad(es)?)?|cant\.? ?(pedida|total|necesaria)?|qty|cantidad pedida)$/;
const UNIDAD = /^(u|un|und|unid|unidad|u\.? ?m|um|medida|unidad de medida|unidades de medida)$/;
const SALTEAR = /^(sub ?)?total|^observaciones|^importe|^precio|^firma|^nota/;

/** "40", "40,5", "1.200", "40 bolsas" → { 40, "bolsas" }. */
function cantidadDe(v: unknown): { cantidad: number | null; unidad: string | null } {
  if (typeof v === "number") return { cantidad: Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null, unidad: null };
  const m = texto(v).match(/^(\d+(?:[.,]\d+)*)\s*(.*)$/);
  if (!m) return { cantidad: null, unidad: null };
  const crudo = m[1];
  // "1.200" son mil doscientos; "1,5" es uno y medio; "1.5" (de una planilla en inglés) también.
  const n = Number(/,/.test(crudo) ? crudo.replace(/\./g, "").replace(",", ".") : /^\d{1,3}(\.\d{3})+$/.test(crudo) ? crudo.replace(/\./g, "") : crudo);
  return { cantidad: Number.isFinite(n) && n > 0 ? n : null, unidad: m[2] ? unidadDe(m[2]) ?? (m[2].length <= 12 ? m[2] : null) : null };
}
const unidadTexto = (v: unknown) => {
  const t = texto(v);
  if (!t) return null;
  return unidadDe(t) ?? (t.length <= 12 ? t : null);
};

function filasDe(hoja: ExcelJS.Worksheet): unknown[][] {
  const filas: unknown[][] = [];
  const hasta = Math.min(hoja.rowCount, 2000);
  for (let n = 1; n <= hasta; n++) {
    const celdas: unknown[] = [];
    hoja.getRow(n).eachCell({ includeEmpty: false }, (c, col) => {
      // En una celda combinada, solo la principal tiene el valor.
      if (c.isMerged && c.master !== c) return;
      celdas[col - 1] = valor(c.value);
    });
    filas.push(celdas);
  }
  return filas;
}

type Columnas = { fila: number; descripcion: number; cantidad: number | null; unidad: number | null };

function buscarEncabezado(filas: unknown[][]): Columnas | null {
  for (let f = 0; f < Math.min(filas.length, 30); f++) {
    const celdas = filas[f].map(normal);
    let descripcion = -1;
    for (const re of DESCRIPCION) {
      descripcion = celdas.findIndex((c) => re.test(c));
      if (descripcion >= 0) break;
    }
    if (descripcion < 0) continue;
    const cantidad = celdas.findIndex((c, i) => i !== descripcion && CANTIDAD.test(c));
    const unidad = celdas.findIndex((c, i) => i !== descripcion && i !== cantidad && UNIDAD.test(c));
    if (cantidad < 0 && unidad < 0) continue;
    return { fila: f, descripcion, cantidad: cantidad >= 0 ? cantidad : null, unidad: unidad >= 0 ? unidad : null };
  }
  return null;
}

function conEncabezado(filas: unknown[][], c: Columnas): RenglonLista[] {
  const out: RenglonLista[] = [];
  for (const fila of filas.slice(c.fila + 1)) {
    const descripcion = texto(fila[c.descripcion]);
    if (!descripcion || descripcion.length < 2 || SALTEAR.test(normal(descripcion))) continue;
    const q = c.cantidad !== null ? cantidadDe(fila[c.cantidad]) : { cantidad: null, unidad: null };
    const unidad = (c.unidad !== null ? unidadTexto(fila[c.unidad]) : null) ?? q.unidad;
    out.push({ descripcion, cantidad: q.cantidad, unidad: q.cantidad ? unidad ?? "u" : null });
    if (out.length >= MAX_RENGLONES) break;
  }
  // Los títulos de sección del final (sin cantidad) no aportan.
  while (out.length && out.at(-1)!.cantidad === null) out.pop();
  return out;
}

/** Sin encabezado: cada fila con un texto y una cantidad. */
function sinEncabezado(filas: unknown[][]): RenglonLista[] {
  const out: RenglonLista[] = [];
  for (const fila of filas) {
    const celdas = fila.map((v, i) => ({ v, i })).filter((x) => x.v !== null && x.v !== undefined && texto(x.v) !== "");
    const textos = celdas.filter((x) => typeof x.v === "string" && !/^\d+([.,]\d+)*$/.test(texto(x.v)) && !unidadDe(texto(x.v)));
    if (!textos.length) continue;
    const d = textos.reduce((a, b) => (texto(b.v).length > texto(a.v).length ? b : a));
    const descripcion = texto(d.v);
    if (descripcion.length < 3 || SALTEAR.test(normal(descripcion))) continue;
    const numeros = celdas.filter((x) => x !== d && cantidadDe(x.v).cantidad !== null);
    const q = numeros.find((x) => x.i > d.i) ?? numeros.filter((x) => x.i < d.i).at(-1);
    if (!q) continue;
    const { cantidad, unidad } = cantidadDe(q.v);
    const u = celdas.find((x) => typeof x.v === "string" && unidadDe(texto(x.v)));
    out.push({ descripcion, cantidad, unidad: (u ? unidadDe(texto(u.v)) : null) ?? unidad ?? "u" });
    if (out.length >= MAX_RENGLONES) break;
  }
  return out;
}

export async function leerListaExcel(datos: ArrayBuffer | Buffer): Promise<RenglonLista[]> {
  const libro = new ExcelJS.Workbook();
  try {
    await libro.xlsx.load(datos as ArrayBuffer);
  } catch {
    return [];
  }
  for (const hoja of libro.worksheets.filter((h) => h.state !== "hidden" && h.state !== "veryHidden")) {
    const filas = filasDe(hoja);
    const enc = buscarEncabezado(filas);
    const renglones = enc ? conEncabezado(filas, enc) : [];
    if (renglones.some((r) => r.cantidad !== null)) return renglones;
    const sueltas = sinEncabezado(filas.slice(enc ? enc.fila + 1 : 0));
    if (sueltas.length) return sueltas;
  }
  return [];
}

/** "40 bolsas Cemento Portland", una por línea (como lo escribe Alejandra; "Pasar a renglones" lo entiende). */
export const textoDeLista = (rs: RenglonLista[]) =>
  rs.map((r) => (r.cantidad ? `${r.cantidad.toLocaleString("es-AR")} ${r.unidad ?? "u"} ${r.descripcion}` : r.descripcion)).join("\n");

export const esExcelLegible = (nombre: string) => /\.xlsx$/i.test(nombre);
