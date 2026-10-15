"use server";

import { db } from "@/lib/db";
import { exigirPermiso } from "@/lib/auth/sesion";
import { ejecutar, ErrorNegocio, type Resultado } from "@/lib/resultado";
import { revalidar } from "@/lib/revalidar";
import { sumarPedidosComo } from "@/lib/pedidos/sumar";
import { descartarOferta } from "./ofrecer";

async function viajeDelChofer(viajeId: string, choferId: string) {
  const v = await db.viaje.findUnique({ where: { id: viajeId }, select: { choferId: true, pedidoId: true } });
  if (!v || v.choferId !== choferId) throw new ErrorNegocio("Este viaje no es tuyo.");
  return v;
}

/** Tarjeta "Pidieron algo más para Darwin" → "Sí, lo llevo": se suma al viaje (paradas en orden y pasos nuevos). */
export async function llevarOferta(viajeId: string, pedidoId: string): Promise<Resultado<{ agregados: number }>> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("pedidos.tomar");
    const v = await viajeDelChofer(viajeId, yo.id);
    const r = await sumarPedidosComo(yo, v.pedidoId, [pedidoId]);
    revalidar("pedidos");
    return r;
  });
}

/** "No": no se le vuelve a ofrecer en este viaje. */
export async function noLlevarOferta(viajeId: string, pedidoId: string): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("pedidos.tomar");
    await viajeDelChofer(viajeId, yo.id);
    await descartarOferta(viajeId, pedidoId);
    revalidar("pedidos");
    return null;
  });
}
