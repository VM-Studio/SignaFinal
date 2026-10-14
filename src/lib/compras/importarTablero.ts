import type { EstadoTablero, TipoOrden } from "@prisma/client";

/**
 * IMPORTAR EL TABLERO DE COMPRAS DESDE EXCEL (puro: lo usan la vista previa en el navegador, la
 * confirmación en el servidor y los tests). Toma las filas tal cual vienen de la planilla de Alejandra
 * ("TABLERO DE CONTROL ORDENES DE C"), las empareja con lo que hay en el sistema y marca cada una:
 * rojo (error: no se importa), amarillo (aviso: se importa, revisar) o bien.
 */

export type Celda = string | number | null;
export type Campo = "tipo" | "numero" | "fecha" | "solicitado" | "obra" | "proveedor" | "importe" | "materiales" | "estado" | "fechaEntrega" | "proximosPasos" | "comentarios";
export const CAMPOS: { campo: Campo; titulo: string; obligatorio?: boolean }[] = [
  { campo: "tipo", titulo: "OC/PE", obligatorio: true },
  { campo: "numero", titulo: "N° OC / PE", obligatorio: true },
  { campo: "fecha", titulo: "Fecha" },
  { campo: "solicitado", titulo: "Solicitado por" },
  { campo: "obra", titulo: "Obra" },
  { campo: "proveedor", titulo: "Proveedor" },
  { campo: "importe", titulo: "Importe" },
  { campo: "materiales", titulo: "Descripción / Materiales" },
  { campo: "estado", titulo: "Estado" },
  { campo: "fechaEntrega", titulo: "Fecha de entrega" },
  { campo: "proximosPasos", titulo: "Observaciones en OC / Próximos pasos" },
  { campo: "comentarios", titulo: "Comentarios" },
];
export type Mapeo = Record<Campo, number | null>;

export const normal = (s: unknown) =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[°º]/g, "").toUpperCase().replace(/[^A-Z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

/** Sus títulos (fila 9) → campos del sistema. Tolera cambios chicos de redacción. */
export function mapeoAutomatico(encabezados: Celda[]): Mapeo {
  const m = Object.fromEntries(CAMPOS.map((c) => [c.campo, null])) as Mapeo;
  encabezados.forEach((h, i) => {
    const t = normal(h);
    if (!t) return;
    const poner = (c: Campo) => { if (m[c] == null) m[c] = i; };
    if (t === "OC PE" || t === "TIPO") poner("tipo");
    else if (/^N\w* ?OC/.test(t) || t === "NUMERO" || t === "NRO") poner("numero");
    else if (t.includes("FECHA") && t.includes("ENTREGA")) poner("fechaEntrega");
    else if (t === "FECHA" || t === "FECHA DEL PEDIDO") poner("fecha");
    else if (t.includes("SOLICITADO")) poner("solicitado");
    else if (t === "OBRA") poner("obra");
    else if (t.includes("PROVEEDOR")) poner("proveedor");
    else if (t.includes("IMPORTE") || t === "MONTO") poner("importe");
    else if (t.includes("DESCRIPCION") || t.includes("MATERIALES") || t.includes("DETALLE")) poner("materiales");
    else if (t === "ESTADO") poner("estado");
    else if (t.includes("PROXIMOS") || t.includes("OBSERVACIONES")) poner("proximosPasos");
    else if (t.includes("COMENTARIO")) poner("comentarios");
  });
  return m;
}

/** ¿Es la fila de encabezados? Busca "N° OC / PE" y "SOLICITADO POR". */
export const esEncabezado = (fila: Celda[]) => {
  const ts = fila.map(normal);
  return ts.some((t) => /^N\w* ?OC ?PE$/.test(t)) && ts.some((t) => t.includes("SOLICITADO POR"));
};

// ─────────────────────────── Valores ───────────────────────────

const MIN_ANIO = 2000;
const MAX_ANIO = 2100;
const iso = (a: number, m: number, d: number) => `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
function fechaValida(a: number, m: number, d: number) {
  if (a < MIN_ANIO || a > MAX_ANIO || m < 1 || m > 12 || d < 1) return false;
  return d <= new Date(Date.UTC(a, m, 0)).getUTCDate();
}

/** Serial de Excel (días desde 1899-12-30), ISO, dd/mm/aaaa o dd/mm/aa. "31/3/0202" no es válida. */
export function leerFecha(v: Celda): { iso: string | null; texto: string | null; invalida: boolean } {
  if (v == null || v === "") return { iso: null, texto: null, invalida: false };
  if (typeof v === "number") {
    if (v > 20000 && v < 80000) {
      const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86_400_000);
      return { iso: d.toISOString().slice(0, 10), texto: null, invalida: false };
    }
    return { iso: null, texto: String(v), invalida: true };
  }
  const t = v.trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m && fechaValida(+m[1], +m[2], +m[3])) return { iso: iso(+m[1], +m[2], +m[3]), texto: null, invalida: false };
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    const anio = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    if (fechaValida(anio, +m[2], +m[1])) return { iso: iso(anio, +m[2], +m[1]), texto: null, invalida: false };
    return { iso: null, texto: t, invalida: true };
  }
  return { iso: null, texto: t, invalida: !!t };
}

/** "$ 723.839,42" → 723839.42 · "????" → a confirmar · "$  -" → vacío. */
export function leerImporte(v: Celda): { valor: number | null; aConfirmar: boolean; texto: string | null } {
  if (v == null || v === "") return { valor: null, aConfirmar: false, texto: null };
  if (typeof v === "number") return Number.isFinite(v) ? { valor: Math.round(v * 100) / 100, aConfirmar: false, texto: null } : { valor: null, aConfirmar: true, texto: String(v) };
  const t = v.trim();
  if (t.includes("?")) return { valor: null, aConfirmar: true, texto: t };
  if (/^=/.test(t)) return { valor: null, aConfirmar: true, texto: t };
  const limpio = t.replace(/US\$|U\$S|\$|ARS|\s/gi, "");
  if (!limpio || /^-+$/.test(limpio)) return { valor: null, aConfirmar: false, texto: null };
  const n = Number(limpio.includes(",") ? limpio.replace(/\./g, "").replace(",", ".") : /^\d{1,3}(\.\d{3})+$/.test(limpio) ? limpio.replace(/\./g, "") : limpio);
  return Number.isFinite(n) ? { valor: Math.round(n * 100) / 100, aConfirmar: false, texto: null } : { valor: null, aConfirmar: true, texto: t };
}

/** "41 B", "20 A", 5 → "5". */
export function leerNumero(v: Celda): { texto: string | null; numero: number | null } {
  if (v == null || v === "") return { texto: null, numero: null };
  if (typeof v === "number") return Number.isInteger(v) && v > 0 ? { texto: String(v), numero: v } : { texto: String(v), numero: null };
  const t = v.trim().replace(/\s+/g, " ").toUpperCase().replace(/^(OC|PE)[\s-]*/, "").replace(/[^0-9A-Z ./-]/g, "").trim();
  if (!t) return { texto: null, numero: null };
  return { texto: t.slice(0, 20), numero: /^\d+$/.test(t) ? Number(t) : null };
}

function distancia(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

const ESTADOS: [string, EstadoTablero][] = [
  ["ENTREGADO", "ENTREGADO"], ["ENTREGADA", "ENTREGADO"], ["ENTREGADOS", "ENTREGADO"], ["ENTREGADAS", "ENTREGADO"],
  ["ANULADA", "ANULADA"], ["ANULADO", "ANULADA"],
  ["ENCARGADO", "ENCARGADO"], ["ENCARGADA", "ENCARGADO"], ["ENCARGADAS", "ENCARGADO"], ["ENCARGADOS", "ENCARGADO"],
  ["AUTORIZADA", "AUTORIZADA"], ["AUTORIZADO", "AUTORIZADA"],
  ["PEDIR AUTORIZACION", "PEDIR_AUTORIZACION"], ["PEDIDO AUTORIZACION", "PEDIR_AUTORIZACION"],
  ["SOLICITUD PRESUPUESTO", "SOLICITUD_PRESUPUESTO"], ["SOLICITUD DE PRESUPUESTO", "SOLICITUD_PRESUPUESTO"],
];
/** Lo que no es un estado aunque esté en la columna: va a Comentarios. */
const NO_ES_ESTADO = ["REPETIDA", "REPETIDO", "EN LA OFICINA"];

/** ENRTEGADO, ENTREGDO, ENTERGADO → ENTREGADO; ANUDALADA → ANULADA; ENCARGADAS → ENCARGADO; AUTORIZADO → AUTORIZADA. */
export function leerEstado(v: Celda): { estado: EstadoTablero | null; texto: string | null; corregido: boolean } {
  const t = normal(v);
  if (!t) return { estado: null, texto: null, corregido: false };
  if (NO_ES_ESTADO.includes(t)) return { estado: null, texto: String(v).trim(), corregido: false };
  const exacto = ESTADOS.find(([k]) => k === t);
  if (exacto) return { estado: exacto[1], texto: null, corregido: false };
  // Errores de tipeo: hasta 2 letras de diferencia en palabras largas.
  let mejor: { e: EstadoTablero; d: number } | null = null;
  for (const [k, e] of ESTADOS) {
    const d = distancia(t, k);
    if (d <= (k.length >= 7 ? 2 : 1) && (!mejor || d < mejor.d)) mejor = { e, d };
  }
  return mejor ? { estado: mejor.e, texto: null, corregido: true } : { estado: null, texto: String(v).trim(), corregido: false };
}

// ─────────────────────────── Emparejar ───────────────────────────

export type Catalogos = {
  usuarios: { id: string; nombre: string }[];
  externos: { id: string; nombre: string }[];
  obras: { id: string; nombre: string; localidad: string }[];
  proveedores: { id: string; nombre: string }[];
};

/** Alias de nombres de la planilla (cómo le dicen) → cómo figura en el sistema. */
const ALIAS_PERSONAS: Record<string, string> = { VICTORIA: "VICKY", DANI: "DANIELA" };

export type Solicitado = { tipo: "u" | "e"; id: string; nombre: string } | { tipo: "nuevo"; nombre: string } | null;
export function emparejarPersona(v: Celda, c: Catalogos): Solicitado {
  const t0 = normal(v);
  if (!t0) return null;
  const t = ALIAS_PERSONAS[t0] ?? t0;
  const por = (n: string) => normal(n);
  const u = c.usuarios.find((x) => por(x.nombre) === t) ?? c.usuarios.find((x) => t.split(" ")[0] === por(x.nombre) && t.split(" ").length === 2 && !c.externos.some((e) => por(e.nombre) === t));
  if (u) return { tipo: "u", id: u.id, nombre: u.nombre };
  const e = c.externos.find((x) => por(x.nombre) === t);
  if (e) return { tipo: "e", id: e.id, nombre: e.nombre };
  const limpio = String(v).trim().replace(/\s+/g, " ");
  return { tipo: "nuevo", nombre: limpio.charAt(0).toUpperCase() + limpio.slice(1).toLowerCase().replace(/ (\p{L})/gu, (_, l: string) => ` ${l.toUpperCase()}`) };
}

const VACIAS_OBRA = new Set(["OBRA", "COUNTRY", "CLUB", "LOTE", "SUC", "SUCURSAL", "EL", "LA", "LOS", "DE", "S", "A", "SA"]);
const romanos = (s: string) => s.replace(/\bI{1,3}\b/g, (m) => String(m.length));
const palabras = (s: string) => romanos(normal(s)).split(" ").filter((w) => w && !VACIAS_OBRA.has(w) && !/^\d{3,}$/.test(w));

/**
 * Obra con tolerancia: "PINARES II", "PINARES LOTE 468" → Pinares II; "DARWIN" → Darwin 1299; "MASCHWITZ"
 * → la obra de Ingeniero Maschwitz. Si hay más de una posible o ninguna, queda pendiente (selector por fila).
 */
export function emparejarObra(v: Celda, c: Catalogos): { id: string | null; texto: string | null; candidatas: string[] } {
  const texto = String(v ?? "").trim();
  if (!texto) return { id: null, texto: null, candidatas: [] };
  const w = palabras(texto);
  const puntaje = (o: Catalogos["obras"][number]) => {
    const ow = palabras(o.nombre);
    const lw = palabras(o.localidad);
    if (!ow.length) return 0;
    const clave = ow[0];
    let p = 0;
    if (w.includes(clave)) p += 10;
    p += w.filter((x) => ow.includes(x)).length * 2;
    // Romanos: "PINARES II" contra "PINARES I" no.
    const numObra = ow.find((x) => /^\d$/.test(x));
    const numTexto = w.find((x) => /^\d$/.test(x));
    if (numObra && numTexto && numObra !== numTexto) p -= 20;
    if (!p && w.some((x) => x.length >= 5 && lw.includes(x))) p += 5;
    return p;
  };
  const puntuadas = c.obras.map((o) => ({ o, p: puntaje(o) })).filter((x) => x.p > 0).sort((a, b) => b.p - a.p);
  if (puntuadas.length && (puntuadas.length === 1 || puntuadas[0].p > puntuadas[1].p)) return { id: puntuadas[0].o.id, texto, candidatas: [] };
  return { id: null, texto, candidatas: puntuadas.slice(0, 3).map((x) => x.o.id) };
}

/** "HORBLOCK - ACOPIO" y "HORBLOCK ACOPIO" son HORBLOCK (el acopio es la condición de pago). */
export const claveProveedor = (s: string) => normal(s).replace(/\b(ACOPIO|SRL|SA|S R L|S A)\b/g, "").replace(/\s+/g, " ").trim();
export function emparejarProveedor(v: Celda, c: Catalogos): { id: string | null; nombre: string | null; nuevo: boolean } {
  const t = String(v ?? "").trim();
  if (!t) return { id: null, nombre: null, nuevo: false };
  const k = claveProveedor(t);
  const p = c.proveedores.find((x) => claveProveedor(x.nombre) === k);
  if (p) return { id: p.id, nombre: p.nombre, nuevo: false };
  const nombre = t.replace(/\s*[-–]\s*ACOPIO\s*$/i, "").replace(/\s+ACOPIO\s*$/i, "").replace(/[.\s]+$/, "").trim();
  return { id: null, nombre, nuevo: true };
}

// ─────────────────────────── Fila ───────────────────────────

export type Correccion = { excluir?: boolean; tipo?: TipoOrden; numero?: string; fecha?: string; obraId?: string | null; estado?: EstadoTablero | "" };

export type FilaRevisada = {
  n: number; // número de fila en el Excel
  tipo: TipoOrden | null;
  numeroTexto: string | null;
  numero: number | null;
  fecha: string | null;
  fechaTexto: string | null;
  solicitado: Solicitado;
  obra: { id: string | null; texto: string | null; candidatas: string[] };
  proveedor: { id: string | null; nombre: string | null; nuevo: boolean };
  importe: number | null;
  importeAConfirmar: boolean;
  materiales: string | null;
  estado: EstadoTablero | null;
  fechaEntrega: string | null;
  proximosPasos: string | null;
  comentarios: string | null;
  errores: string[];
  avisos: string[];
  excluida: boolean;
};

const texto = (v: Celda) => (v == null ? null : String(v).trim() || null);

export function revisarFila(n: number, celdas: Celda[], m: Mapeo, c: Catalogos, corr: Correccion = {}): FilaRevisada {
  const de = (k: Campo) => (m[k] == null ? null : celdas[m[k]!] ?? null);
  const errores: string[] = [];
  const avisos: string[] = [];
  const extra: string[] = [];

  const tipoTexto = normal(de("tipo"));
  const tipo: TipoOrden | null = corr.tipo ?? (tipoTexto === "OC" || tipoTexto === "PE" ? tipoTexto : null);
  if (!tipo) errores.push(tipoTexto ? `Tipo “${texto(de("tipo"))}”: tiene que ser OC o PE.` : "Falta OC/PE.");

  const num = corr.numero != null ? leerNumero(corr.numero) : leerNumero(de("numero"));
  if (!num.texto) errores.push("Falta el número.");

  const f = corr.fecha != null ? leerFecha(corr.fecha || null) : leerFecha(de("fecha"));
  if (f.invalida) avisos.push(`Fecha inválida (“${f.texto}”): queda la de hoy y el texto en Comentarios.`);
  if (f.invalida && f.texto) extra.push(`Fecha en el Excel: ${f.texto}`);

  const solicitado = emparejarPersona(de("solicitado"), c);
  if (solicitado?.tipo === "nuevo") avisos.push(`“${solicitado.nombre}” no está en Solicitado por: se agrega sin usuario.`);

  const obraAuto = emparejarObra(de("obra"), c);
  const obra = corr.obraId !== undefined ? { ...obraAuto, id: corr.obraId, candidatas: [] } : obraAuto;
  if (obra.texto && !obra.id) avisos.push(`Obra “${obra.texto}” sin emparejar: elegila o queda como texto.`);

  const proveedor = emparejarProveedor(de("proveedor"), c);
  if (proveedor.nuevo) avisos.push(`Proveedor “${proveedor.nombre}” nuevo: se crea sin sucursal (completar dirección).`);

  const imp = leerImporte(de("importe"));
  if (imp.aConfirmar && imp.texto && !imp.texto.includes("?")) avisos.push(`Importe “${imp.texto}” no se pudo leer: queda “A confirmar”.`);

  const est = corr.estado !== undefined ? { estado: corr.estado || null, texto: null, corregido: false } : leerEstado(de("estado"));
  if (est.corregido) avisos.push(`Estado “${texto(de("estado"))}” corregido a ${est.estado}.`);
  if (est.texto) { extra.push(est.texto); avisos.push(`“${est.texto.replace(/\n/g, " ")}” no es un estado: va a Comentarios.`); }

  const fe = leerFecha(de("fechaEntrega"));
  if (fe.texto) extra.push(`Fecha de entrega: ${fe.texto}`);

  const comentarios = [texto(de("comentarios")), ...extra].filter(Boolean).join("\n") || null;
  return {
    n, tipo, numeroTexto: num.texto, numero: num.numero, fecha: f.iso, fechaTexto: f.texto, solicitado, obra, proveedor,
    importe: imp.valor, importeAConfirmar: imp.aConfirmar, materiales: texto(de("materiales")), estado: est.estado,
    fechaEntrega: fe.iso, proximosPasos: texto(de("proximosPasos")), comentarios, errores, avisos, excluida: !!corr.excluir,
  };
}

/** Todas las filas, con los repetidos dentro del archivo (misma clave tipo + número) marcados. */
export function revisarTodo(filas: { n: number; celdas: Celda[] }[], m: Mapeo, c: Catalogos, correcciones: Record<number, Correccion> = {}) {
  const revisadas = filas.map((f) => revisarFila(f.n, f.celdas, m, c, correcciones[f.n]));
  const vistas = new Map<string, number>();
  for (const r of revisadas) {
    if (r.excluida || !r.tipo || !r.numeroTexto) continue;
    const k = `${r.tipo}-${r.numeroTexto}`;
    if (vistas.has(k)) r.errores.push(`Repetida: el ${k} ya está en la fila ${vistas.get(k)}. Corregí el número o excluila.`);
    else vistas.set(k, r.n);
  }
  return revisadas;
}

export const filaValida = (r: FilaRevisada) => !r.excluida && r.errores.length === 0;

/** Una fila vacía de la planilla (no se muestra). */
export const filaVacia = (celdas: Celda[], m: Mapeo) => ["tipo", "numero", "materiales", "proveedor", "obra"].every((k) => {
  const i = m[k as Campo];
  return i == null || celdas[i] == null || String(celdas[i]).trim() === "";
});
