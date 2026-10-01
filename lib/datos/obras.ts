import "server-only";
import { db } from "@/lib/db";
import type { UsuarioActual } from "@/lib/auth/usuario-actual";

/** Obras activas que la persona puede usar al pedir: los responsables, las suyas; el resto, todas. */
export async function obrasDe(usuario: UsuarioActual) {
  return db.obra.findMany({
    where: { activa: true, ...(usuario.rol === "RESPONSABLE_OBRA" ? { responsables: { some: { id: usuario.id } } } : {}) },
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true, direccion: true, localidad: true },
  });
}

export async function idsObrasDe(usuario: UsuarioActual): Promise<string[] | null> {
  if (usuario.rol !== "RESPONSABLE_OBRA") return null; // null = todas
  return (await obrasDe(usuario)).map((o) => o.id);
}
