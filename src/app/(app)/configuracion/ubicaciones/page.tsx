import type { Metadata } from "next";
import { Warehouse } from "lucide-react";
import { exigirPermiso } from "@/lib/auth/sesion";
import { db } from "@/lib/db";
import { Insignia, Tarjeta, Titulo, Vacio } from "@/components/ui/basicos";
import { MapaPunto } from "@/components/mapa/punto";
import { BotonUbicacion, type UbicacionEditable } from "@/components/ubicaciones/formulario";

export const metadata: Metadata = { title: "Depósitos y base" };

/** Depósitos, terrenos y base (Dirección y Administración): alta rápida y edición con la dirección en el mapa. */
export default async function PaginaUbicaciones() {
  await exigirPermiso("ubicaciones.cargar");
  const lugares = await db.ubicacion.findMany({
    where: { tipo: { in: ["DEPOSITO", "BASE_VEHICULOS"] } },
    orderBy: [{ activa: "desc" }, { tipo: "desc" }, { nombre: "asc" }],
    include: { _count: { select: { herramientas: { where: { activo: true } }, vehiculosBase: { where: { activo: true } } } } },
  });
  return (
    <div>
      <Titulo siempre detalle="Donde se guardan las herramientas y los camiones. Aparecen como origen al pedir un viaje." accion={<BotonUbicacion />}>Depósitos y base</Titulo>
      {lugares.length === 0 ? <Vacio icono={<Warehouse />} titulo="Sin depósitos cargados" /> : (
        <ul className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {lugares.map((u) => {
            const editable: UbicacionEditable = { id: u.id, nombre: u.nombre, tipo: u.tipo === "BASE_VEHICULOS" ? "BASE_VEHICULOS" : "DEPOSITO", etiqueta: (u.etiqueta as UbicacionEditable["etiqueta"]) ?? (u.tipo === "BASE_VEHICULOS" ? "Base" : "Galpón"), direccion: u.direccion, localidad: u.localidad ?? "", lat: u.latitud, lng: u.longitud, activa: u.activa };
            return (
              <li key={u.id}>
                <Tarjeta className={`flex h-full flex-col gap-3 p-4 ${u.activa ? "" : "opacity-60"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">{u.nombre}</p>
                      <p className="text-sm text-suave">{u.direccion}{u.localidad && !u.direccion.includes(u.localidad) ? `, ${u.localidad}` : ""}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Insignia tono="neutro">{u.etiqueta ?? (u.tipo === "BASE_VEHICULOS" ? "Base" : "Depósito")}</Insignia>
                      {!u.activa && <Insignia tono="neutro">Inactivo</Insignia>}
                    </div>
                  </div>
                  <MapaPunto lat={u.latitud} lng={u.longitud} />
                  <div className="mt-auto flex items-center justify-between gap-2">
                    <p className="text-sm text-suave">{u.tipo === "BASE_VEHICULOS" ? `${u._count.vehiculosBase} vehículos` : `${u._count.herramientas} herramientas sueltas`}</p>
                    <BotonUbicacion inicial={editable} />
                  </div>
                </Tarjeta>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
