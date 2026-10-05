import "server-only";
import { headers } from "next/headers";
import type { Prisma, PrismaClient, Rol } from "@prisma/client";
import { obtenerSesion } from "@/lib/auth/sesion";

type Cliente = Prisma.TransactionClient | PrismaClient;

export type DatosAuditoria = {
  /** Quién lo hizo (null = el sistema: GPS, cron). */
  usuarioId?: string | null;
  accion: string;
  entidad: string;
  entidadId: string;
  /** Texto corto legible: "Daniela pidió hierro para Obra Darwin". Es lo que se ve en Actividad. */
  resumen: string;
  antes?: Prisma.InputJsonValue;
  despues?: Prisma.InputJsonValue;
};

/** IP y navegador de quien hizo la acción. Fuera de un request (cron, seed) no hay. */
async function origen() {
  try {
    const h = await headers();
    return {
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null,
      userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
    };
  } catch {
    return { ip: null, userAgent: null };
  }
}

/** El rol se toma de la sesión (ya cargada en el request); si es otro usuario, de la base. */
async function rolDe(cliente: Cliente, usuarioId: string): Promise<Rol | null> {
  try {
    const s = await obtenerSesion();
    if (s?.id === usuarioId) return s.rol;
  } catch {}
  const u = await cliente.usuario.findUnique({ where: { id: usuarioId }, select: { rol: true } });
  return u?.rol ?? null;
}

/** Toda acción deja auditoría por acá: quién, con qué rol, desde dónde y un resumen legible. */
export async function auditar(cliente: Cliente, d: DatosAuditoria) {
  const [rol, o] = await Promise.all([d.usuarioId ? rolDe(cliente, d.usuarioId) : null, origen()]);
  await cliente.auditoria.create({
    data: {
      usuarioId: d.usuarioId ?? null,
      rol,
      accion: d.accion,
      entidad: d.entidad,
      entidadId: d.entidadId,
      resumen: d.resumen.slice(0, 300),
      antes: d.antes,
      despues: d.despues,
      ...o,
    },
  });
}
