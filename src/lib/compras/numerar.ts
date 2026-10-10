import type { Prisma } from "@prisma/client";

/**
 * NUMERACIÓN DE ÓRDENES DE COMPRA: OC-AAAA-NNNN. Un número nunca se repite ni se reutiliza (aunque la
 * OC se rechace o se anule) y arranca de nuevo cada año (año de Buenos Aires).
 *
 * Se toma DENTRO de la transacción que envía la OC a aprobación, con la fila del año bloqueada
 * (SELECT … FOR UPDATE): dos envíos al mismo tiempo esperan uno al otro y nunca leen el mismo último.
 * Si la transacción falla, el número no se gasta (vuelve atrás con ella).
 */

export const anioArgentina = (fecha = new Date()) =>
  Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric" }).format(fecha));

export const formatoOC = (anio: number, secuencia: number) => `OC-${anio}-${String(secuencia).padStart(4, "0")}`;

export async function siguienteNumeroOC(tx: Prisma.TransactionClient, anio = anioArgentina()) {
  // La fila del año existe (la primera OC del año la crea).
  await tx.$executeRaw`INSERT INTO "NumeradorOC" ("anio", "ultimo") VALUES (${anio}, 0) ON CONFLICT ("anio") DO NOTHING`;
  const filas = await tx.$queryRaw<{ ultimo: number }[]>`SELECT "ultimo" FROM "NumeradorOC" WHERE "anio" = ${anio} FOR UPDATE`;
  const secuencia = Number(filas[0].ultimo) + 1;
  await tx.$executeRaw`UPDATE "NumeradorOC" SET "ultimo" = ${secuencia} WHERE "anio" = ${anio}`;
  return { anio, secuencia, numero: formatoOC(anio, secuencia) };
}

/**
 * BORRADOR → ESPERANDO_APROBACION con su número. Si la OC ya tenía número (reenvío), lo conserva.
 * Los borradores no gastan número.
 */
export async function asignarNumeroOC(tx: Prisma.TransactionClient, ordenCompraId: string, anio = anioArgentina()) {
  const oc = await tx.ordenCompra.findUniqueOrThrow({ where: { id: ordenCompraId }, select: { numero: true, anio: true, secuencia: true } });
  if (oc.numero) return { numero: oc.numero, anio: oc.anio!, secuencia: oc.secuencia! };
  const n = await siguienteNumeroOC(tx, anio);
  await tx.ordenCompra.update({ where: { id: ordenCompraId }, data: { numero: n.numero, anio: n.anio, secuencia: n.secuencia } });
  return n;
}
