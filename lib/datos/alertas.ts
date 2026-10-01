import "server-only";
import { db } from "@/lib/db";
import { AREAS_ALERTA_POR_ROL } from "@/lib/permisos";
import type { UsuarioActual } from "@/lib/auth/usuario-actual";
import type { Prisma } from "@prisma/client";

function filtro(usuario: UsuarioActual): Prisma.AlertaWhereInput {
  const areas = AREAS_ALERTA_POR_ROL[usuario.rol];
  const base: Prisma.AlertaWhereInput = { activa: true, area: { in: areas } };
  // El chofer solo ve lo que es suyo: su licencia y los pedidos sin tomar.
  if (usuario.rol === "CHOFER") {
    return { ...base, OR: [{ regla: "PEDIDO_SIN_TOMAR" }, { clave: `LICENCIA:${usuario.id}` }] };
  }
  if (usuario.rol === "RESPONSABLE_OBRA") return { ...base, regla: { in: ["PEDIDO_SIN_TOMAR", "VIAJE_DEMORADO"] } };
  return base;
}

export async function contarAlertasCriticas(usuario: UsuarioActual) {
  return db.alerta.count({ where: { ...filtro(usuario), severidad: "CRITICO" } });
}

export async function alertasPara(usuario: UsuarioActual) {
  const [activas, resueltas] = await Promise.all([
    db.alerta.findMany({ where: filtro(usuario), orderBy: [{ severidad: "desc" }, { creadaEn: "desc" }] }),
    db.alerta.findMany({
      where: { ...filtro(usuario), activa: false, resueltaEn: { gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) } },
      orderBy: { resueltaEn: "desc" },
      take: 20,
    }),
  ]);
  return { activas, resueltas };
}
