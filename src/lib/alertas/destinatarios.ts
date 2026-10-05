import type { Prisma, Rol } from "@prisma/client";

/**
 * Quién ve cada alerta. Cada regla tiene sus roles; además la ve la persona puntual
 * (usuarioId: el chofer de ese vehículo, el solicitante de ese pedido). Nadie más.
 * DIRECCION ve todas. RESPONSABLE_OBRA solo las de sus obras.
 * La migración "nueva_logica_viajes" usa la misma matriz para las alertas existentes.
 */
export const DESTINATARIOS: Record<string, Rol[]> = {
  // Pedidos y viajes
  PENDIENTE_HOY: ["DIRECCION", "CHOFER"],
  URGENTE_SIN_TOMAR: ["DIRECCION", "CHOFER", "RESPONSABLE_OBRA", "CAPATAZ"],
  DUPLICADO: ["DIRECCION", "RESPONSABLE_OBRA", "CAPATAZ"],
  VIAJE_LARGO: ["DIRECCION"],
  // Rastreo
  PARADO_EN_VIAJE: ["DIRECCION"],
  FUERA_HORARIO: ["DIRECCION", "ADMINISTRACION"],
  // Flota
  DOCUMENTO: ["DIRECCION", "ADMINISTRACION"],
  SERVICE: ["DIRECCION", "ADMINISTRACION"],
  CONSUMO: ["DIRECCION", "ADMINISTRACION"],
  LICENCIA: ["DIRECCION", "ADMINISTRACION"],
  // Depósito
  DEVOLUCION_VENCIDA: ["DIRECCION", "DEPOSITO", "RESPONSABLE_OBRA", "CAPATAZ"],
  MAQUINA_OBRA_PARADA: ["DIRECCION", "DEPOSITO", "RESPONSABLE_OBRA", "CAPATAZ"],
  MANT_MAQUINA: ["DIRECCION", "DEPOSITO"],
};

export const rolesDeRegla = (regla: string): Rol[] => DESTINATARIOS[regla] ?? ["DIRECCION"];

/** Las alertas que puede ver un usuario. misObras: solo hace falta para RESPONSABLE_OBRA. */
export function filtroDestinatario(u: { id: string; rol: Rol }, misObras: string[] = []): Prisma.AlertaWhereInput {
  if (u.rol === "DIRECCION") return {};
  return {
    OR: [
      { usuarioId: u.id },
      { rolesDestino: { has: u.rol }, ...(u.rol === "RESPONSABLE_OBRA" ? { obraId: { in: misObras } } : {}) },
    ],
  };
}
