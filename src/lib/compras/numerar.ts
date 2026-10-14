import type { Prisma, TipoOrden } from "@prisma/client";

/**
 * NUMERACIÓN DE ÓRDENES: OC-NNNN (orden de compra) y PE-NNNN (pedido especial), cada tipo con su
 * numeración, sin año (como la planilla de Alejandra). Un número nunca se repite ni se reutiliza
 * (aunque la orden se rechace o se anule).
 *
 * Se toma DENTRO de la transacción que envía la orden a aprobación, con la fila del tipo bloqueada
 * (SELECT … FOR UPDATE): dos envíos al mismo tiempo esperan uno al otro y nunca leen el mismo último.
 * Si la transacción falla, el número no se gasta (vuelve atrás con ella).
 */

/** Formato del número (cambiar acá si cambia el de Compras). */
export const FORMATO_NUMERO = { digitos: 4, separador: "-" } as const;

export const formatoOC = (tipo: TipoOrden, secuencia: number | string) =>
  `${tipo}${FORMATO_NUMERO.separador}${typeof secuencia === "number" ? String(secuencia).padStart(FORMATO_NUMERO.digitos, "0") : secuencia}`;

/** Lo que se ve en el tablero (columna "N° OC / PE"): el número tal cual, sin prefijo ni ceros. */
export const numeroCorto = (o: { numeroTexto: string | null; secuencia: number | null; numero: string | null }) =>
  o.numeroTexto ?? (o.secuencia != null ? String(o.secuencia) : o.numero ?? "");

export const anioArgentina = (fecha = new Date()) =>
  Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric" }).format(fecha));

export async function siguienteNumero(tx: Prisma.TransactionClient, tipo: TipoOrden) {
  // La fila del tipo existe (la primera orden la crea).
  await tx.$executeRaw`INSERT INTO "NumeradorOC" ("tipo", "ultimo") VALUES (${tipo}::"TipoOrden", 0) ON CONFLICT ("tipo") DO NOTHING`;
  const filas = await tx.$queryRaw<{ ultimo: number }[]>`SELECT "ultimo" FROM "NumeradorOC" WHERE "tipo" = ${tipo}::"TipoOrden" FOR UPDATE`;
  const secuencia = Number(filas[0].ultimo) + 1;
  await tx.$executeRaw`UPDATE "NumeradorOC" SET "ultimo" = ${secuencia} WHERE "tipo" = ${tipo}::"TipoOrden"`;
  return { secuencia, numero: formatoOC(tipo, secuencia) };
}

/**
 * BORRADOR → ESPERANDO_APROBACION con su número. Si la orden ya tenía número (reenvío o v2), lo
 * conserva. Los borradores no gastan número.
 */
export async function asignarNumeroOC(tx: Prisma.TransactionClient, ordenCompraId: string) {
  const oc = await tx.ordenCompra.findUniqueOrThrow({ where: { id: ordenCompraId }, select: { tipo: true, numero: true, secuencia: true } });
  if (oc.numero) return { numero: oc.numero, secuencia: oc.secuencia };
  const n = await siguienteNumero(tx, oc.tipo);
  await tx.ordenCompra.update({ where: { id: ordenCompraId }, data: { numero: n.numero, numeroTexto: String(n.secuencia), secuencia: n.secuencia, anio: anioArgentina() } });
  return n;
}

/**
 * Subir el numerador (DIRECCION, /configuracion/compras, o la importación del Excel): nunca baja,
 * así un número ya usado no se repite. Devuelve el último que queda.
 */
export async function subirNumerador(tx: Prisma.TransactionClient, tipo: TipoOrden, ultimo: number) {
  await tx.$executeRaw`INSERT INTO "NumeradorOC" ("tipo", "ultimo") VALUES (${tipo}::"TipoOrden", 0) ON CONFLICT ("tipo") DO NOTHING`;
  const filas = await tx.$queryRaw<{ ultimo: number }[]>`SELECT "ultimo" FROM "NumeradorOC" WHERE "tipo" = ${tipo}::"TipoOrden" FOR UPDATE`;
  const actual = Number(filas[0].ultimo);
  if (ultimo <= actual) return actual;
  await tx.$executeRaw`UPDATE "NumeradorOC" SET "ultimo" = ${ultimo} WHERE "tipo" = ${tipo}::"TipoOrden"`;
  return ultimo;
}
