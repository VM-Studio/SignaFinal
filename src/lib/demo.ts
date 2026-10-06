import "server-only";
import { db } from "@/lib/db";
import { ROL } from "@/lib/etiquetas";

export const modoDemo = () => process.env.MODO_DEMO === "true";

/** Contraseña de los usuarios de la carga de demo (prisma/seed.ts). Solo se usa con MODO_DEMO=true. */
export const CONTRASENA_DEMO = "signa2026";

export async function usuariosDemo() {
  if (!modoDemo()) return null;
  const usuarios = await db.usuario.findMany({
    where: { activo: true, email: { endsWith: "@signa.demo" } },
    orderBy: [{ rol: "asc" }, { nombre: "asc" }],
    select: { nombre: true, email: true, rol: true, obrasACargo: { where: { activo: true }, select: { obra: { select: { nombre: true } } }, orderBy: [{ principal: "desc" }, { creadoEn: "asc" }] } },
  });
  // Para probar cada versión de la app de un toque: el rol y, para responsables, sus obras.
  return usuarios.map((u) => ({
    nombre: u.nombre,
    email: u.email,
    rol: ROL[u.rol],
    obras: u.rol === "RESPONSABLE_OBRA" ? u.obrasACargo.map((r) => r.obra.nombre).join(", ") : u.rol === "CAPATAZ" ? "Todas las obras" : null,
  }));
}
