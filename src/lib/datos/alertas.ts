import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { exigirPermiso } from "@/lib/auth/sesion";
import { ALERTAS_POR_ROL } from "@/lib/permisos";

async function filtro(): Promise<Prisma.AlertaWhereInput> {
  const u = await exigirPermiso("alertas.ver");
  const tipos = ALERTAS_POR_ROL[u.rol];
  return { estado: { not: "RESUELTA" }, ...(tipos === "todas" ? {} : { entidadTipo: { in: tipos } }) };
}

export async function contarAlertasAbiertas() {
  return db.alerta.count({ where: { ...(await filtro()), estado: "ABIERTA" } });
}

export async function contarAlertasCriticas() {
  return db.alerta.count({ where: { ...(await filtro()), severidad: "CRITICA" } });
}

export async function listarAlertas() {
  return db.alerta.findMany({ where: await filtro(), orderBy: [{ severidad: "desc" }, { creadaEn: "desc" }] });
}
