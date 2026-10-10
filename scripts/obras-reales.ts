/**
 * Carga las OBRAS REALES y el Terreno Humboldt en una base que ya tiene datos (producción), sin borrar
 * nada y sin duplicar: si la obra ya está (por nombre o alias, ej. "A. Thomas"), le pone el nombre real y
 * le suma los responsables que falten; conserva su dirección y coordenadas (ya confirmadas en el mapa).
 *
 *   npx tsx scripts/obras-reales.ts            (contra DATABASE_URL)
 */
import { PrismaClient } from "@prisma/client";
import { OBRAS_REALES, UBICACIONES_REALES, ubicar } from "../src/lib/base/obras";

const db = new PrismaClient();
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

async function main() {
  const usuarios = new Map((await db.usuario.findMany({ select: { id: true, email: true } })).map((u) => [u.email.split("@")[0], u.id]));
  const obras = await db.obra.findMany({ select: { id: true, nombre: true, codigo: true } });
  const log: string[] = [];

  for (const o of OBRAS_REALES) {
    const nombres = [o.nombre, ...(o.alias ?? [])].map(norm);
    const ya = obras.find((x) => nombres.includes(norm(x.nombre)) || x.codigo === o.codigo);
    let obraId: string;
    if (ya) {
      obraId = ya.id;
      if (ya.nombre !== o.nombre) {
        await db.obra.update({ where: { id: ya.id }, data: { nombre: o.nombre } });
        log.push(`"${ya.nombre}" → "${o.nombre}" (ya estaba; se conserva su dirección)`);
      } else log.push(`${o.nombre}: ya estaba`);
    } else {
      const punto = await ubicar(db, o.busqueda, o.aprox);
      const codigo = (await db.obra.findUnique({ where: { codigo: o.codigo } })) ? `${o.codigo}-${Date.now().toString(36)}` : o.codigo;
      obraId = (await db.obra.create({ data: { codigo, nombre: o.nombre, direccion: o.direccion, localidad: o.localidad, latitud: punto.lat, longitud: punto.lng } })).id;
      log.push(`${o.nombre}: creada${punto.geocodificada ? "" : " (ubicación a confirmar)"}`);
    }
    for (const email of [...new Set([...o.responsables, ...(o.principal ? [o.principal] : []), "cesar", "lolo"])]) {
      const usuarioId = usuarios.get(email);
      if (!usuarioId) continue;
      await db.responsableObra.upsert({
        where: { obraId_usuarioId: { obraId, usuarioId } },
        create: { obraId, usuarioId, principal: email === o.principal },
        update: { activo: true, hastaEn: null, ...(email === o.principal ? { principal: true } : {}) },
      });
    }
  }

  for (const x of UBICACIONES_REALES) {
    const ya = await db.ubicacion.findFirst({ where: { nombre: x.nombre } });
    if (ya) {
      await db.ubicacion.update({ where: { id: ya.id }, data: { etiqueta: ya.etiqueta ?? x.etiqueta, localidad: ya.localidad ?? x.localidad, activa: true } });
      log.push(`${x.nombre}: ya estaba`);
    } else {
      const punto = await ubicar(db, x.busqueda, x.aprox);
      await db.ubicacion.create({ data: { nombre: x.nombre, tipo: x.tipo, etiqueta: x.etiqueta, direccion: x.direccion, localidad: x.localidad, latitud: punto.lat, longitud: punto.lng } });
      log.push(`${x.nombre}: creado${punto.geocodificada ? "" : " (ubicación a confirmar)"}`);
    }
  }
  console.log(log.join("\n"));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
