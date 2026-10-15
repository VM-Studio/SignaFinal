/**
 * CARGA LA DOCUMENTACIÓN REAL DE LA FLOTA desde docs/flota/documentacion.json (solo local: tiene datos y fotos
 * reales y el repo es público; ejemplo en docs/flota/documentacion.ejemplo.json). Cada fila:
 *   { patente, tipo, emisor, numero, vencimiento, archivo, notas? }
 *   tipo: SEGURO · VTV · CEDULA · PATENTE · HABILITACION_PESADO · RUTA · OTRO (o "Seguro", "Cédula verde", …)
 *   vencimiento: 2027-03-31 o 31/03/2027 · archivo: ruta a la foto o el PDF, relativa a docs/flota/ (máx. 3 MB)
 * No duplica: si el vehículo ya tiene ese documento con el mismo número y vencimiento, lo saltea. Cada carga
 * queda en la Auditoría. Primero muestra lo que va a hacer; con --cargar lo guarda.
 *
 *   npx tsx scripts/cargar-documentacion.ts            (revisar)
 *   npx tsx scripts/cargar-documentacion.ts --cargar   (guardar; DATABASE_URL elige la base)
 */
import { readFileSync, existsSync } from "node:fs";
import { extname, join } from "node:path";
import { PrismaClient, type TipoDocumentoVehiculo } from "@prisma/client";

if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(".env");
  } catch {}
}

const DIR = "docs/flota";
const MAX_BYTES = 3 * 1024 * 1024;
const MIME: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".pdf": "application/pdf" };
const TIPOS: Record<string, TipoDocumentoVehiculo> = {
  seguro: "SEGURO", vtv: "VTV", cedula: "CEDULA", "cedula verde": "CEDULA", "cedula azul": "CEDULA", "cedula verde/azul": "CEDULA",
  patente: "PATENTE", impuesto: "PATENTE", "patente/impuesto": "PATENTE", habilitacion_pesado: "HABILITACION_PESADO",
  "habilitacion de transito pesado": "HABILITACION_PESADO", ruta: "RUTA", otro: "OTRO",
};
const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

type Fila = { patente: string; tipo: string; emisor?: string; numero?: string; vencimiento?: string; archivo: string; notas?: string };

function fecha(v?: string) {
  if (!v) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
  const ar = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v.trim());
  const [a, m, d] = iso ? [iso[1], iso[2], iso[3]] : ar ? [ar[3], ar[2].padStart(2, "0"), ar[1].padStart(2, "0")] : [];
  if (!a) throw new Error(`Vencimiento "${v}": usá 2027-03-31 o 31/03/2027.`);
  return new Date(`${a}-${m}-${d}T12:00:00-03:00`);
}

async function main() {
  const cargar = process.argv.includes("--cargar");
  const ruta = join(DIR, "documentacion.json");
  if (!existsSync(ruta)) throw new Error(`No está ${ruta}. Copiá documentacion.ejemplo.json y completalo.`);
  const filas = JSON.parse(readFileSync(ruta, "utf8")) as Fila[];
  const db = new PrismaClient();
  const base = (process.env.DATABASE_URL ?? "").replace(/:\/\/[^@]*@/, "://…@");
  console.log(`${filas.length} documentos · base ${base} · ${cargar ? "CARGANDO" : "solo revisión (--cargar para guardar)"}`);
  const quien = await db.usuario.findFirst({ where: { rol: "DIRECCION", activo: true }, select: { id: true, nombre: true } });
  let errores = 0;
  let cargados = 0;
  try {
    for (const [i, f] of filas.entries()) {
      const n = `#${i + 1} ${f.patente} ${f.tipo}`;
      try {
        const tipo = TIPOS[sinTildes(f.tipo)] ?? (f.tipo.toUpperCase() as TipoDocumentoVehiculo);
        if (!Object.values(TIPOS).includes(tipo)) throw new Error(`tipo "${f.tipo}" desconocido`);
        const v = await db.vehiculo.findFirst({ where: { patente: f.patente.replace(/\s/g, "").toUpperCase() }, select: { id: true, nombre: true } });
        if (!v) throw new Error(`no hay vehículo con patente ${f.patente}`);
        const vencimiento = fecha(f.vencimiento);
        if (["SEGURO", "VTV", "RUTA", "HABILITACION_PESADO"].includes(tipo) && !vencimiento) throw new Error("falta el vencimiento");
        const archivo = join(DIR, f.archivo);
        if (!existsSync(archivo)) throw new Error(`no está el archivo ${archivo}`);
        const mime = MIME[extname(archivo).toLowerCase()];
        if (!mime) throw new Error("el archivo tiene que ser jpg, png, webp o pdf");
        const datos = readFileSync(archivo);
        if (datos.length > MAX_BYTES) throw new Error(`el archivo pesa ${(datos.length / 1024 / 1024).toFixed(1)} MB (máximo 3 MB)`);
        const ya = await db.documentoVehiculo.findFirst({ where: { vehiculoId: v.id, tipo, numero: f.numero ?? null, vencimiento } });
        if (ya) {
          console.log(`  = ${n}: ya estaba (${v.nombre})`);
          continue;
        }
        console.log(`  + ${n}: ${v.nombre} · ${f.emisor ?? "—"} ${f.numero ?? ""} · vence ${vencimiento ? vencimiento.toISOString().slice(0, 10) : "—"}`);
        if (!cargar) continue;
        await db.$transaction(async (tx) => {
          const a = await tx.archivo.create({ data: { tipo: mime, nombre: `${tipo.toLowerCase()}-${f.patente}`, datos, tamano: datos.length, subidoPorId: quien?.id ?? null } });
          const doc = await tx.documentoVehiculo.create({ data: { vehiculoId: v.id, tipo, emisor: f.emisor ?? null, numero: f.numero ?? null, vencimiento, archivoUrl: `/api/archivos/${a.id}`, notas: f.notas ?? null } });
          if (quien) {
            await tx.auditoria.create({ data: { usuarioId: quien.id, accion: "vehiculo.documento", entidad: "Vehiculo", entidadId: v.id, resumen: `Se cargó ${tipo} de ${v.nombre}${f.emisor ? ` (${f.emisor}${f.numero ? ` ${f.numero}` : ""})` : ""} desde los papeles (scripts/cargar-documentacion.ts)`, despues: { documentoId: doc.id } } });
          }
        });
        cargados++;
      } catch (e) {
        errores++;
        console.log(`  ✗ ${n}: ${e instanceof Error ? e.message : e}`);
      }
    }
  } finally {
    await db.$disconnect();
  }
  console.log(cargar ? `\nListo: ${cargados} cargados, ${errores} con error.` : `\n${errores} con error. Si está todo bien: --cargar.`);
  if (errores) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
