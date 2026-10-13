"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { exigirSesion } from "@/lib/auth/sesion";
import { ejecutar, ErrorNegocio, type Resultado } from "@/lib/resultado";
import { auditar } from "@/lib/auditoria";
import { historialMateriales, historialViajes, precargaMaterial, precargaViaje, type ItemHistorial, type PrecargaMateriales, type PrecargaViaje } from "./consultas";

/** El buscador del panel "Pedidos anteriores" (material, obra o número de OC). */
export async function buscarHistorial(tipo: "MATERIALES" | "VIAJE", q: string, todas = false): Promise<Resultado<ItemHistorial[]>> {
  return ejecutar(async () => (tipo === "MATERIALES" ? historialMateriales({ q, todas }) : historialViajes({ q })));
}

/** "Repetir": los datos para precargar el formulario (la fecha, nunca). */
export async function datosParaRepetir(tipo: "MATERIALES" | "VIAJE", pedidoId: string, todas = false): Promise<Resultado<PrecargaMateriales | PrecargaViaje>> {
  return ejecutar(async () => {
    const p = tipo === "MATERIALES" ? await precargaMaterial(pedidoId, todas) : await precargaViaje(pedidoId);
    if (!p) throw new ErrorNegocio(tipo === "VIAJE" ? "Ese pedido no se puede repetir (los retiros en proveedor se repiten desde el pedido de materiales)." : "Ese pedido ya no está disponible.");
    return p;
  });
}

const nombreEsquema = z.string().trim().min(2, "Ponele un nombre.").max(60);

/** Estrella: guarda el pedido como favorito con un nombre ("Pedido semanal de cemento"). */
export async function marcarFavorito(entrada: { tipo: "MATERIALES" | "VIAJE"; pedidoId: string; nombre: string; todas?: boolean }): Promise<Resultado<{ id: string }>> {
  return ejecutar(async () => {
    const yo = await exigirSesion();
    const nombre = nombreEsquema.parse(entrada.nombre);
    const datos = entrada.tipo === "MATERIALES" ? await precargaMaterial(entrada.pedidoId, !!entrada.todas) : await precargaViaje(entrada.pedidoId);
    if (!datos) throw new ErrorNegocio("Ese pedido no se puede guardar como favorito.");
    const ya = await db.pedidoFavorito.findFirst({ where: { usuarioId: yo.id, pedidoId: entrada.pedidoId, activo: true }, select: { id: true } });
    if (ya) return ya;
    const f = await db.pedidoFavorito.create({ data: { usuarioId: yo.id, tipo: entrada.tipo, nombre, pedidoId: entrada.pedidoId, datos: datos as object }, select: { id: true } });
    await auditar(db, { usuarioId: yo.id, accion: "favorito.marcar", entidad: "PedidoFavorito", entidadId: f.id, resumen: `${yo.nombre} guardó como favorito "${nombre}" (pedido #${datos.origen.numero})` });
    return f;
  });
}

export async function renombrarFavorito(id: string, nombre: string): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirSesion();
    const n = nombreEsquema.parse(nombre);
    const r = await db.pedidoFavorito.updateMany({ where: { id, usuarioId: yo.id, activo: true }, data: { nombre: n } });
    if (!r.count) throw new ErrorNegocio("Ese favorito ya no existe.");
    await auditar(db, { usuarioId: yo.id, accion: "favorito.renombrar", entidad: "PedidoFavorito", entidadId: id, resumen: `${yo.nombre} renombró un favorito: "${n}"` });
    return null;
  });
}

/** Sacar la estrella (no se borra: queda inactivo). */
export async function quitarFavorito(id: string): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirSesion();
    const f = await db.pedidoFavorito.findFirst({ where: { id, usuarioId: yo.id, activo: true }, select: { nombre: true } });
    if (!f) throw new ErrorNegocio("Ese favorito ya no existe.");
    await db.pedidoFavorito.update({ where: { id }, data: { activo: false } });
    await auditar(db, { usuarioId: yo.id, accion: "favorito.quitar", entidad: "PedidoFavorito", entidadId: id, resumen: `${yo.nombre} sacó de favoritos "${f.nombre}"` });
    return null;
  });
}
