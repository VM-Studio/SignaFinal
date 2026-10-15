import "server-only";
import type { EstadoOC, Rol } from "@prisma/client";
import { db } from "@/lib/db";
import { esObraDelUsuario } from "@/lib/alcance";
import { veDocumentos, type Contexto } from "./permisosCeldas";

/**
 * Quién ve un documento de compra y con qué contexto se deciden sus celdas (permisosCeldas.ts).
 * Compras, Dirección y Administración ven todos; la gente de obra, los que creó o pidió y los de sus
 * obras (el capataz, de todas). Chofer y Depósito, ninguno.
 */
type Usuario = { id: string; rol: Rol };
type DocAcceso = { creadaPorId: string; solicitanteId: string | null; obraId: string | null; estado: EstadoOC; fuente: string; ordenPagoAutorizadaEn: Date | null };

const esObra = (rol: Rol) => rol === "RESPONSABLE_OBRA" || rol === "CAPATAZ";

export async function esDeSuObra(u: Usuario, obraId: string | null) {
  if (!esObra(u.rol) || !obraId) return false;
  return esObraDelUsuario(u, obraId);
}

export async function puedeVerDocumento(u: Usuario, d: Pick<DocAcceso, "creadaPorId" | "solicitanteId" | "obraId">) {
  if (!veDocumentos(u.rol)) return false;
  if (u.rol === "COMPRAS" || u.rol === "DIRECCION" || u.rol === "ADMINISTRACION") return true;
  if (d.creadaPorId === u.id || d.solicitanteId === u.id) return true;
  return esDeSuObra(u, d.obraId);
}

export async function contextoCeldas(u: Usuario, d: DocAcceso, extra: Pick<Contexto, "modificar" | "valor"> = {}): Promise<Contexto> {
  return {
    rol: u.rol,
    estado: d.estado,
    esCreador: d.creadaPorId === u.id || d.solicitanteId === u.id,
    esDeSuObra: await esDeSuObra(u, d.obraId),
    pagoAutorizado: !!d.ordenPagoAutorizadaEn,
    importada: d.fuente === "IMPORTADA",
    ...extra,
  };
}

/** Filtro de Prisma con lo que ve cada uno (listas). */
export async function alcanceDocumentos(u: Usuario) {
  if (!veDocumentos(u.rol)) return { id: "__ninguno__" };
  if (u.rol === "COMPRAS" || u.rol === "DIRECCION" || u.rol === "ADMINISTRACION" || u.rol === "CAPATAZ") return {};
  const obras = (await db.responsableObra.findMany({ where: { usuarioId: u.id, activo: true }, select: { obraId: true } })).map((r) => r.obraId);
  return { OR: [{ creadaPorId: u.id }, { solicitanteId: u.id }, { obraId: { in: obras } }] };
}
