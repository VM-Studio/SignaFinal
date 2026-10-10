"use server";

import { db } from "@/lib/db";
import { exigirPermiso } from "@/lib/auth/sesion";
import { ejecutar, ErrorNegocio, type Resultado } from "@/lib/resultado";
import { sugerenciasPara, type SugerenciaPlana } from "./combinar";

/** "Aprovechá el viaje" al aceptar: qué otros pedidos conviene llevar con este. */
export async function sugerenciasAlAceptar(pedidoId: string): Promise<Resultado<{ dia: string; sugerencias: SugerenciaPlana[] }>> {
  return ejecutar(async () => {
    const u = await exigirPermiso("pedidos.tomar");
    return sugerenciasPara(u, [pedidoId]);
  });
}

/** "Agregar parada" desde la pantalla del viaje: las mismas sugerencias, sobre todos los pedidos del viaje. */
export async function sugerenciasDelViaje(pedidoId: string): Promise<Resultado<{ dia: string; sugerencias: SugerenciaPlana[] }>> {
  return ejecutar(async () => {
    const u = await exigirPermiso("pedidos.tomar");
    const v = await db.viaje.findFirst({ where: { pedidos: { some: { id: pedidoId } } }, select: { choferId: true, pedidos: { select: { id: true } } } });
    if (!v || v.choferId !== u.id) throw new ErrorNegocio("Este viaje no es tuyo.");
    return sugerenciasPara(u, v.pedidos.map((p) => p.id));
  });
}
