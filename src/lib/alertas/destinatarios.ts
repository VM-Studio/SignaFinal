import type { Prisma, Rol } from "@prisma/client";

/**
 * Quién ve cada alerta (CLAUDE.md, "Reglas de visibilidad"). Una fila por regla:
 * - roles: los roles que la ven enteros.
 * - personas: además, las personas puntuales que calcula la regla (el solicitante, el chofer,
 *   quien tiene la herramienta…), pero SOLO si su rol está en esta lista.
 * DIRECCION ve todas. Un responsable de obra nunca ve flota, licencias, combustible ni choferes;
 * un chofer nunca ve depósito ni las de otros choferes.
 * La migración "alertas_por_persona" usa la misma matriz para las alertas existentes.
 */
const OBRA: Rol[] = ["RESPONSABLE_OBRA", "CAPATAZ"];

export const DESTINATARIOS: Record<string, { roles: Rol[]; personas: Rol[] }> = {
  // Pedidos y viajes
  URGENTE_SIN_TOMAR: { roles: ["DIRECCION", "CHOFER"], personas: [...OBRA, "DIRECCION"] }, // + el solicitante
  PENDIENTE_HOY: { roles: ["DIRECCION", "CHOFER"], personas: [] },
  DUPLICADO: { roles: ["DIRECCION"], personas: [...OBRA, "DIRECCION"] }, // + los dos solicitantes
  VIAJE_LARGO: { roles: ["DIRECCION"], personas: ["CHOFER"] }, // + el chofer de ese viaje
  // Rastreo
  FUERA_HORARIO: { roles: ["DIRECCION", "ADMINISTRACION"], personas: [] },
  PARADO_EN_VIAJE: { roles: ["DIRECCION", "ADMINISTRACION"], personas: [] },
  // Flota (nunca a gente de obra)
  DOCUMENTO: { roles: ["DIRECCION", "ADMINISTRACION"], personas: ["CHOFER"] }, // + quien tiene el vehículo
  LICENCIA: { roles: ["DIRECCION", "ADMINISTRACION"], personas: ["CHOFER"] }, // + ese chofer
  SERVICE: { roles: ["DIRECCION", "ADMINISTRACION"], personas: ["CHOFER"] }, // + quien tiene el vehículo
  CONSUMO: { roles: ["DIRECCION", "ADMINISTRACION"], personas: [] },
  // Depósito (nunca a choferes)
  DEVOLUCION_VENCIDA: { roles: ["DIRECCION", "DEPOSITO"], personas: OBRA }, // + quien la tiene y los responsables de la obra
  MAQUINA_OBRA_PARADA: { roles: ["DIRECCION", "DEPOSITO"], personas: [] },
  MANT_MAQUINA: { roles: ["DIRECCION", "DEPOSITO"], personas: [] },
  // Materiales y Compras
  MATERIAL_SIN_RETIRAR: { roles: ["DIRECCION", "COMPRAS"], personas: OBRA }, // + el que pidió y los responsables de la obra
  MATERIAL_DEMORADO: { roles: ["DIRECCION", "COMPRAS"], personas: [] },
  APROBACION_DEMORADA: { roles: ["DIRECCION"], personas: [] },
};

const SIN_REGLA = { roles: ["DIRECCION"] as Rol[], personas: [] as Rol[] };

export const rolesDeRegla = (regla: string): Rol[] => (DESTINATARIOS[regla] ?? SIN_REGLA).roles;

/** De las personas que calculó la regla, las que pueden verla según su rol. */
export function personasDeRegla(regla: string, candidatas: { id: string; rol: Rol }[]): string[] {
  const permitidos = (DESTINATARIOS[regla] ?? SIN_REGLA).personas;
  return [...new Set(candidatas.filter((c) => permitidos.includes(c.rol)).map((c) => c.id))];
}

/** Las alertas que puede ver un usuario: las de su rol o las que lo nombran. Dirección: todas. */
export function filtroDestinatario(u: { id: string; rol: Rol }): Prisma.AlertaWhereInput {
  if (u.rol === "DIRECCION") return {};
  return { OR: [{ usuariosDestino: { has: u.id } }, { rolesDestino: { has: u.rol } }] };
}
