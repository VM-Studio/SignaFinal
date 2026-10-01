import { db } from "@/lib/db";
import { clienteLebane } from "./index";

export type ResumenSincronizacion = {
  origen: "mock" | "api";
  obras: number;
  proveedores: number;
  ordenes: number;
};

/**
 * Trae obras, proveedores y órdenes de compra de Lebane y actualiza la copia local.
 * Lo que ya no viene de Lebane se marca inactivo (nada se borra).
 */
export async function sincronizarLebane(): Promise<ResumenSincronizacion> {
  const lebane = clienteLebane();
  const [obras, proveedores, ordenes] = await Promise.all([
    lebane.listarObras(),
    lebane.listarProveedores(),
    lebane.listarOrdenesCompra(),
  ]);
  const ahora = new Date();

  await db.$transaction(
    async (tx) => {
      for (const o of obras) {
        const datos = {
          nombre: o.nombre,
          direccion: o.direccion,
          localidad: o.localidad ?? null,
          lat: o.lat ?? null,
          lng: o.lng ?? null,
          activa: o.activa,
          sincronizadaEn: ahora,
        };
        await tx.obra.upsert({ where: { idLebane: o.idLebane }, create: { idLebane: o.idLebane, ...datos }, update: datos });
      }
      await tx.obra.updateMany({
        where: { idLebane: { notIn: obras.map((o) => o.idLebane) } },
        data: { activa: false },
      });

      for (const p of proveedores) {
        const datos = {
          nombre: p.nombre,
          rubro: p.rubro ?? null,
          direccion: p.direccion,
          localidad: p.localidad ?? null,
          lat: p.lat ?? null,
          lng: p.lng ?? null,
          telefono: p.telefono ?? null,
          activo: p.activo,
          sincronizadoEn: ahora,
        };
        await tx.proveedor.upsert({ where: { idLebane: p.idLebane }, create: { idLebane: p.idLebane, ...datos }, update: datos });
      }
      await tx.proveedor.updateMany({
        where: { idLebane: { notIn: proveedores.map((p) => p.idLebane) } },
        data: { activo: false },
      });

      const idsObra = new Map((await tx.obra.findMany({ select: { id: true, idLebane: true } })).map((o) => [o.idLebane, o.id]));
      const idsProv = new Map((await tx.proveedor.findMany({ select: { id: true, idLebane: true } })).map((p) => [p.idLebane, p.id]));

      for (const oc of ordenes) {
        const obraId = idsObra.get(oc.idLebaneObra);
        const proveedorId = idsProv.get(oc.idLebaneProveedor);
        if (!obraId || !proveedorId) continue;
        const datos = {
          numero: oc.numero,
          fecha: new Date(oc.fecha),
          descripcion: oc.descripcion,
          pesoEstimadoKg: oc.pesoEstimadoKg ?? null,
          abierta: oc.abierta,
          obraId,
          proveedorId,
          sincronizadaEn: ahora,
        };
        await tx.ordenCompra.upsert({ where: { idLebane: oc.idLebane }, create: { idLebane: oc.idLebane, ...datos }, update: datos });
      }
    },
    { timeout: 60_000 },
  );

  return { origen: lebane.origen, obras: obras.length, proveedores: proveedores.length, ordenes: ordenes.length };
}
