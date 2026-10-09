/**
 * A quién le llega cada aviso, sin base de datos (lo prueban los tests de la matriz).
 * Regla general: nadie recibe un aviso de algo que no puede abrir, un responsable de obra nunca
 * recibe avisos de otra obra y quien hizo la acción no se avisa a sí mismo.
 */
import type { Rol } from "@prisma/client";
import { rutaNueva, rutaPermitida } from "../permisos";

/** Destinatario de un evento: una persona, todos los de un rol o los responsables de una obra. */
export type Destinatario =
  | { usuario: string | null | undefined; push: boolean; enlace?: string }
  | { rol: Rol; push: boolean; enlace?: string }
  | { obra: string; push: boolean; enlace?: string };

/** Lo mínimo de cada usuario activo para decidir: rol y obras donde es responsable. */
export type Persona = { id: string; rol: Rol; obras: string[] };

export type Entrega = { usuarioId: string; push: boolean; enlace: string | null };
export type Descarte = { usuarioId: string; motivo: string };

/** El enlace tal como lo abre ese rol (rutas viejas o neutras → la de su pantalla). Null si no lo puede abrir. */
export function enlacePara(rol: Rol, enlace: string | null): string | null | false {
  if (!enlace) return null;
  const [ruta, query] = enlace.split("?");
  if (rutaPermitida(rol, ruta)) return enlace;
  const nueva = rutaNueva(rol, ruta);
  if (nueva && rutaPermitida(rol, nueva)) return query ? `${nueva}?${query}` : nueva;
  return false;
}

export function resolverDestinatarios(
  para: Destinatario[],
  personas: Persona[],
  o: { enlace: string | null; obraId?: string | null; actor?: string | null },
): { entregas: Entrega[]; descartes: Descarte[] } {
  const porId = new Map(personas.map((p) => [p.id, p]));
  // Cada persona una sola vez: si aparece por dos caminos, con push si alguno lo pide.
  const juntos = new Map<string, { push: boolean; enlace?: string }>();
  const sumar = (id: string, d: Destinatario) => {
    const ya = juntos.get(id);
    juntos.set(id, { push: (ya?.push ?? false) || d.push, enlace: ya?.enlace ?? d.enlace });
  };
  for (const d of para) {
    if ("usuario" in d) {
      if (d.usuario) sumar(d.usuario, d);
    } else if ("rol" in d) {
      for (const p of personas) if (p.rol === d.rol) sumar(p.id, d);
    } else {
      for (const p of personas) if (p.obras.includes(d.obra)) sumar(p.id, d);
    }
  }

  const entregas: Entrega[] = [];
  const descartes: Descarte[] = [];
  for (const [id, d] of juntos) {
    const p = porId.get(id);
    if (!p) {
      descartes.push({ usuarioId: id, motivo: "no está activo" });
      continue;
    }
    if (id === o.actor) continue; // quien hizo la acción ya lo sabe
    if (o.obraId && p.rol === "RESPONSABLE_OBRA" && !p.obras.includes(o.obraId)) {
      descartes.push({ usuarioId: id, motivo: "no es responsable de esa obra" });
      continue;
    }
    const enlace = enlacePara(p.rol, d.enlace ?? o.enlace);
    if (enlace === false) {
      descartes.push({ usuarioId: id, motivo: `no puede abrir ${d.enlace ?? o.enlace}` });
      continue;
    }
    entregas.push({ usuarioId: id, push: d.push, enlace });
  }
  return { entregas, descartes };
}
