import "server-only";
import type { Prisma, Rol } from "@prisma/client";
import { db } from "@/lib/db";
import { exigirPermiso } from "@/lib/auth/sesion";

/** Las personas de la app, con sus obras (responsables) y la licencia (choferes). */
export async function listaUsuarios(f: { rol?: Rol; q?: string; inactivos?: boolean }) {
  await exigirPermiso("usuarios.gestionar");
  const where: Prisma.UsuarioWhereInput = {
    ...(f.rol ? { rol: f.rol } : {}),
    ...(f.inactivos ? {} : { activo: true }),
    ...(f.q ? { OR: [{ nombre: { contains: f.q, mode: "insensitive" } }, { email: { contains: f.q, mode: "insensitive" } }] } : {}),
  };
  const [usuarios, obras] = await Promise.all([
    db.usuario.findMany({
      where,
      orderBy: [{ activo: "desc" }, { rol: "asc" }, { nombre: "asc" }],
      take: 300,
      select: {
        id: true, nombre: true, email: true, rol: true, telefono: true, activo: true, licenciaCategoria: true, licenciaVencimiento: true,
        vehiculoAsignado: { select: { nombre: true } },
        obrasACargo: { where: { activo: true }, orderBy: [{ principal: "desc" }, { creadoEn: "asc" }], select: { obraId: true, principal: true, obra: { select: { nombre: true } } } },
      },
    }),
    db.obra.findMany({ where: { estado: { not: "FINALIZADA" } }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
  ]);
  return { usuarios, obras };
}

export type UsuarioLista = Awaited<ReturnType<typeof listaUsuarios>>["usuarios"][number];
