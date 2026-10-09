"use server";

import { db } from "@/lib/db";
import { exigirPermiso } from "@/lib/auth/sesion";
import { auditar } from "@/lib/auditoria";
import { ejecutar, ErrorNegocio, type Resultado } from "@/lib/resultado";
import { revalidar } from "@/lib/revalidar";
import { fuenteCusat } from "./index";
import { sincronizar } from "./sincronizar";
import { CLAVE, guardarEstado, leerEstado, type SinEnlazar } from "./estado";
import type { Prueba } from "./tipos";

const refrescar = () => {
  revalidar("flota");
};

/** "Probar conexión": ingreso, posiciones, dirección e historial de hoy, con el resultado resumido. */
export async function probarConexion(): Promise<Resultado<Prueba>> {
  return ejecutar(async () => {
    await exigirPermiso("rastreo.configurar");
    return fuenteCusat().probar();
  });
}

/** "Sincronizar ahora". */
export async function sincronizarAhora(): Promise<Resultado<{ texto: string }>> {
  return ejecutar(async () => {
    await exigirPermiso("rastreo.configurar");
    const r = await sincronizar();
    if (!r.ok) throw new ErrorNegocio(`No se pudo sincronizar: ${r.error}`);
    refrescar();
    return { texto: `${r.recibidas} vehículos en Cusat, ${r.enlazadas} enlazados, ${r.nuevas} posiciones nuevas (${(r.ms / 1000).toFixed(1)} s).` };
  });
}

/** Enlazar a mano una unidad de Cusat con un vehículo de la base (o desenlazar con vehiculoId vacío). */
export async function enlazar(idExterno: string, vehiculoId: string): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("rastreo.configurar");
    await db.$transaction(async (tx) => {
      const antes = await tx.vehiculo.findFirst({ where: { idCusat: idExterno }, select: { id: true, nombre: true } });
      if (antes) await tx.vehiculo.update({ where: { id: antes.id }, data: { idCusat: null } });
      let v: { nombre: string } | null = null;
      if (vehiculoId) {
        const sin = (await leerEstado<SinEnlazar>(CLAVE.sinEnlazar))?.valor ?? [];
        const unidad = sin.find((u) => u.idExterno === idExterno);
        v = await tx.vehiculo.update({ where: { id: vehiculoId }, data: { idCusat: idExterno, ...(unidad ? { cusatNombre: unidad.nombre } : {}) }, select: { nombre: true } });
        await guardarEstado(CLAVE.sinEnlazar, sin.filter((u) => u.idExterno !== idExterno));
      }
      await auditar(tx, {
        usuarioId: yo.id, accion: vehiculoId ? "cusat.enlazar" : "cusat.desenlazar", entidad: "Vehiculo", entidadId: vehiculoId || antes?.id || idExterno,
        resumen: vehiculoId ? `${yo.nombre} enlazó la unidad ${idExterno} de Cusat con ${v?.nombre}` : `${yo.nombre} desenlazó la unidad ${idExterno} de Cusat${antes ? ` (era ${antes.nombre})` : ""}`,
        antes: { vehiculo: antes?.nombre ?? null }, despues: { vehiculo: v?.nombre ?? null },
      });
    });
    refrescar();
    return null;
  });
}
