/**
 * Prueba el adaptador real de Cusat View contra cusatglobal.com, sin tocar la base:
 * ingreso, posiciones actuales (los seis vehículos de la flota), dirección e historial de hoy
 * del Mercedes 710.
 *
 *   npx tsx scripts/cusat-probar.ts
 *
 * Lee CUSAT_WEB_USER y CUSAT_WEB_PASS de .env. No muestra credenciales.
 */
import { CusatView } from "../src/lib/cusat/cusatView";

try {
  process.loadEnvFile(".env");
} catch {}

const FLOTA = ["HFD336", "AH282PU", "AG149BJ", "AC689NR", "AF399OO", "AF399OP"];

async function main() {
  const cusat = new CusatView();
  console.log("Probando Cusat View…\n");
  const prueba = await cusat.probar();
  for (const p of prueba.pasos) console.log(`${p.ok ? "OK " : "MAL"} ${p.paso} (${p.ms} ms): ${p.detalle}`);

  const r = await cusat.obtenerPosicionesActuales();
  if (!r.ok) return console.log(`\nNo se pudieron leer posiciones: ${r.error}`);
  console.log(`\nFlota (${r.datos.length} unidades en la cuenta):`);
  for (const patente of FLOTA) {
    const p = r.datos.find((x) => x.patente.replace(/\W/g, "").toUpperCase() === patente);
    console.log(p
      ? `  ${p.nombre.padEnd(14)} ${p.patente.padEnd(8)} ${p.latitud.toFixed(5)}, ${p.longitud.toFixed(5)} · ${p.velocidadKmh} km/h · ${p.motorEncendido ? "contacto" : "sin contacto"} · ${p.fechaGps.toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}`
      : `  ${patente}: NO APARECE`);
  }

  const mercedes = r.datos.find((x) => x.patente.toUpperCase() === "HFD336");
  if (!mercedes) return;
  console.log(`\nDirección del Mercedes 710: ${(await cusat.obtenerDireccion(mercedes.idExterno)) ?? "sin dirección"}`);
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
  const desde = new Date(`${hoy}T00:00:00-03:00`);
  const porId = await cusat.obtenerHistorial(mercedes.idExterno, desde, new Date());
  const resumen = (h: typeof porId) => (h.ok ? `${h.datos.length} puntos${h.datos.length ? `, de ${h.datos[0].fecha.toISOString()} a ${h.datos.at(-1)!.fecha.toISOString()}` : ""}` : `error: ${h.error}`);
  console.log(`Historial de hoy del Mercedes 710: ${resumen(porId)}`);
  if (porId.ok && porId.datos[0]) console.log(`Primer punto: ${JSON.stringify(porId.datos[0])}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
