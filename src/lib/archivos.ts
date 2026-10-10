import "server-only";
import type { EntidadAdjunto, Prisma } from "@prisma/client";
import { del, get, put } from "@vercel/blob";
import { db } from "@/lib/db";
import { ErrorNegocio } from "@/lib/resultado";

const TIPOS = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_BYTES = 3 * 1024 * 1024;

/**
 * Guarda un archivo que llega como data URL (la foto ya viene comprimida desde el teléfono)
 * y devuelve la URL con la que se sirve.
 */
export async function guardarArchivo(tx: Prisma.TransactionClient, dataUrl: string, subidoPorId: string, nombre?: string) {
  const m = /^data:([\w/+.-]+);base64,(.+)$/.exec(dataUrl);
  if (!m) throw new ErrorNegocio("El archivo no se pudo leer. Probá sacar la foto de nuevo.");
  const [, tipo, base64] = m;
  if (!TIPOS.includes(tipo)) throw new ErrorNegocio("Solo se aceptan fotos o PDF.");
  const datos = Buffer.from(base64, "base64");
  if (datos.length > MAX_BYTES) throw new ErrorNegocio("El archivo es muy grande (máximo 3 MB).");
  const a = await tx.archivo.create({ data: { tipo, nombre: nombre ?? null, datos, tamano: datos.length, subidoPorId }, select: { id: true } });
  return `/api/archivos/${a.id}`;
}


// ═══════════════════════════ ADJUNTOS (Vercel Blob) ═══════════════════════════

/** Lo que se puede adjuntar: PDF, Excel, Word, CSV y fotos. */
export const TIPOS_ADJUNTO: Record<string, string> = {
  pdf: "application/pdf",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  csv: "text/csv",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  heic: "image/heic",
};
export const MAX_ADJUNTO_BYTES = 20 * 1024 * 1024;
/** Más grande que esto, el archivo va directo del navegador a Blob (las funciones de Vercel aceptan hasta 4,5 MB). */
export const MAX_POR_SERVIDOR_BYTES = 4 * 1024 * 1024;

/** Carpeta en el almacenamiento según a qué pertenece el archivo. */
export const CARPETAS: Record<EntidadAdjunto, string> = {
  PEDIDO_MATERIAL: "pedidos-material", ORDEN_COMPRA: "ordenes-compra", VIAJE: "viajes", HERRAMIENTA: "herramientas", VEHICULO: "vehiculos",
};

export const SIN_ALMACENAMIENTO = "Almacenamiento de archivos no configurado";

/** En Vercel hace falta BLOB_READ_WRITE_TOKEN. En la máquina de desarrollo, sin token, se guarda en la base. */
export const almacenamiento = (): "blob" | "base" | null => (process.env.BLOB_READ_WRITE_TOKEN ? "blob" : process.env.VERCEL ? null : "base");

/** Público o privado según cómo se creó el store (privado por defecto: OC con precios, listas de obra). */
export const accesoBlob = () => (process.env.BLOB_ACCESO === "public" ? "public" : "private") as "public" | "private";

const extension = (nombre: string) => nombre.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";

/** Valida tipo y tamaño. Devuelve el tipo MIME que se guarda (por la extensión: el del navegador no siempre viene). */
export function validarArchivo(nombre: string, tamano: number, tipoNavegador?: string) {
  const ext = extension(nombre);
  const tipo = TIPOS_ADJUNTO[ext];
  if (!tipo) throw new ErrorNegocio(`"${nombre}": solo se aceptan PDF, Excel, Word, CSV o fotos (jpg, png, heic).`);
  if (tamano <= 0) throw new ErrorNegocio(`"${nombre}" está vacío.`);
  if (tamano > MAX_ADJUNTO_BYTES) throw new ErrorNegocio(`"${nombre}" pesa ${(tamano / 1024 / 1024).toFixed(1)} MB: el máximo es 20 MB.`);
  return tipoNavegador && Object.values(TIPOS_ADJUNTO).includes(tipoNavegador) ? tipoNavegador : tipo;
}

/** Nombre único y prolijo para guardar: carpeta/2026-10-10-planilla-materiales-abc123.xlsx */
export function nombreUnico(nombre: string, carpeta: string) {
  const ext = extension(nombre);
  const base = nombre.replace(/\.[^.]+$/, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "archivo";
  const azar = Math.random().toString(36).slice(2, 8);
  return `${carpeta.replace(/[^a-z0-9/-]/gi, "")}/${new Date().toISOString().slice(0, 10)}-${base}-${azar}.${ext}`;
}

/**
 * Sube un archivo y devuelve su URL de almacenamiento (Blob, o "db:<id>" en la máquina de desarrollo).
 * La app nunca muestra esta URL: los archivos se sirven con sesión en /api/adjuntos/[id].
 */
export async function subir(archivo: { nombre: string; tipo?: string; datos: Buffer | Blob }, carpeta: string, subidoPorId?: string) {
  const tamano = archivo.datos instanceof Blob ? archivo.datos.size : archivo.datos.length;
  const tipo = validarArchivo(archivo.nombre, tamano, archivo.tipo);
  const modo = almacenamiento();
  if (!modo) throw new ErrorNegocio(SIN_ALMACENAMIENTO);
  if (modo === "base") {
    const datos = new Uint8Array(archivo.datos instanceof Blob ? await archivo.datos.arrayBuffer() : archivo.datos);
    const a = await db.archivo.create({ data: { tipo, nombre: archivo.nombre, datos, tamano, subidoPorId: subidoPorId ?? null }, select: { id: true } });
    return { url: `db:${a.id}`, tipo, tamano };
  }
  const r = await put(nombreUnico(archivo.nombre, carpeta), archivo.datos, { access: accesoBlob(), contentType: tipo, addRandomSuffix: false });
  return { url: r.url, tipo, tamano };
}

/** Borra un archivo del almacenamiento (los Adjunto no se borran: se usa al reemplazar un PDF generado). */
export async function eliminar(url: string) {
  if (url.startsWith("db:")) {
    await db.archivo.delete({ where: { id: url.slice(3) } }).catch(() => {});
    return;
  }
  if (process.env.BLOB_READ_WRITE_TOKEN) await del(url).catch(() => {});
}

/** El contenido de un archivo guardado (para servirlo con sesión o para leer un Excel adjunto). */
export async function leer(url: string): Promise<{ datos: ReadableStream | Uint8Array; tipo: string } | null> {
  if (url.startsWith("db:")) {
    const a = await db.archivo.findUnique({ where: { id: url.slice(3) } });
    return a ? { datos: new Uint8Array(a.datos), tipo: a.tipo } : null;
  }
  if (url.startsWith("/api/archivos/")) {
    const a = await db.archivo.findUnique({ where: { id: url.split("/").pop()! } });
    return a ? { datos: new Uint8Array(a.datos), tipo: a.tipo } : null;
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  const r = await get(url, { access: accesoBlob() });
  return r?.stream ? { datos: r.stream, tipo: r.blob.contentType ?? "application/octet-stream" } : null;
}

export async function leerBuffer(url: string) {
  const r = await leer(url);
  if (!r) return null;
  if (r.datos instanceof Uint8Array) return Buffer.from(r.datos);
  return Buffer.from(await new Response(r.datos).arrayBuffer());
}

/** Crea el Adjunto (entidadId vacío mientras el formulario no se confirma). */
export async function registrarAdjunto(d: { entidadTipo: EntidadAdjunto; entidadId?: string | null; nombre: string; url: string; tipoMime: string; tamanoBytes: number; subidoPorId: string; interno?: boolean }) {
  return db.adjunto.create({
    data: { entidadTipo: d.entidadTipo, entidadId: d.entidadId ?? null, nombre: d.nombre.slice(0, 200), url: d.url, tipoMime: d.tipoMime, tamanoBytes: d.tamanoBytes, subidoPorId: d.subidoPorId, interno: !!d.interno },
    select: { id: true, nombre: true, tipoMime: true, tamanoBytes: true, entidadTipo: true, creadoEn: true },
  });
}

/** Al confirmar un formulario: los adjuntos que subió esa persona quedan enganchados a la entidad. */
export async function engancharAdjuntos(tx: Prisma.TransactionClient, ids: string[], entidadTipo: EntidadAdjunto, entidadId: string, subidoPorId: string) {
  if (!ids.length) return 0;
  const r = await tx.adjunto.updateMany({ where: { id: { in: ids }, entidadTipo, subidoPorId, entidadId: null }, data: { entidadId } });
  return r.count;
}

export type AdjuntoPlano = { id: string; nombre: string; tipoMime: string; tamanoBytes: number; interno: boolean; creadoEn: string; subidoPor: string };

/** Los adjuntos de una entidad, para mostrar (sin las internas si no corresponde). */
export async function adjuntosDe(entidadTipo: EntidadAdjunto, entidadId: string, conInternos: boolean): Promise<AdjuntoPlano[]> {
  const a = await db.adjunto.findMany({
    where: { entidadTipo, entidadId, ...(conInternos ? {} : { interno: false }) },
    orderBy: { creadoEn: "asc" },
    select: { id: true, nombre: true, tipoMime: true, tamanoBytes: true, interno: true, creadoEn: true, subidoPor: { select: { nombre: true } } },
  });
  return a.map((x) => ({ ...x, creadoEn: x.creadoEn.toISOString(), subidoPor: x.subidoPor.nombre }));
}
