import Link from "next/link";
import type { Metadata } from "next";
import { CalendarClock, Plus, Truck } from "lucide-react";
import { exigirPermiso } from "@/lib/auth/sesion";
import { puede } from "@/lib/permisos";
import { ESTADO_VEHICULO, listarFlota, opcionesVehiculo } from "@/lib/flota/consultas";
import { Cifra, Insignia, Titulo, Vacio } from "@/components/ui/basicos";
import { BotonLink } from "@/components/ui/boton";
import { ConHoja } from "@/components/ui/hoja";
import { FormularioVehiculo, VEHICULO_NUEVO } from "@/components/flota/formularios";
import { DOCUMENTO } from "@/lib/etiquetas";
import { vencimiento, fecha } from "@/lib/formato";

export const metadata: Metadata = { title: "Flota" };

const TIPO = { CAMION: "Camión", CAMIONETA: "Camioneta", AUTO: "Auto", MAQUINA: "Máquina" } as const;

export default async function PaginaFlota() {
  const u = await exigirPermiso("flota.ver");
  const { vehiculos, resumen } = await listarFlota();
  const editar = puede(u.rol, "flota.editar");

  const proximo = (p: (typeof vehiculos)[number]["proximo"]) => {
    if (!p) return <span className="text-suave">Sin vencimientos cargados</span>;
    const v = vencimiento(p.vencimiento);
    return v.dias <= 30 ? (
      <Insignia tono={v.tono}>{DOCUMENTO[p.tipo]}: {v.texto.toLowerCase()}</Insignia>
    ) : (
      <span className="text-suave">{DOCUMENTO[p.tipo]} · {fecha(p.vencimiento)}</span>
    );
  };
  const quien = (v: (typeof vehiculos)[number]) => (v.enViaje ? `${v.enViaje.chofer} → Obra ${v.enViaje.obra}` : v.asignadoA ? `Asignada a ${v.asignadoA}` : v.entraEnCola ? "Cola de pedidos" : "—");

  return (
    <div>
      <Titulo
        detalle={`${vehiculos.length} vehículos activos`}
        accion={
          <div className="flex gap-2">
            {puede(u.rol, "flota.agenda") && <BotonLink href="/flota/agenda" variante="secundario" icono={<CalendarClock className="size-5" />}>Agenda</BotonLink>}
            {editar && (
              <ConHoja titulo="Agregar vehículo" etiqueta="Agregar" icono={<Plus className="size-5" />}>
                <FormularioVehiculo inicial={VEHICULO_NUEVO} {...await opcionesVehiculo()} />
              </ConHoja>
            )}
          </div>
        }
      >
        Flota
      </Titulo>

      <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3">
        <Cifra etiqueta="Disponibles" valor={resumen.disponibles} tono="ok" />
        <Cifra etiqueta="En viaje" valor={resumen.enViaje} />
        <Cifra etiqueta="En el taller" valor={resumen.enTaller} tono={resumen.enTaller ? "aviso" : undefined} />
        <Cifra etiqueta="Con documentación vencida" valor={resumen.docVencida} tono={resumen.docVencida ? "critico" : "ok"} />
      </div>

      {vehiculos.length === 0 ? (
        <Vacio icono={<Truck className="size-10" />} titulo="No hay vehículos cargados" />
      ) : (
        <>
          <ul className="flex flex-col gap-2 lg:hidden">
            {vehiculos.map((v) => (
              <li key={v.id}>
                <Link href={`/flota/${v.id}`} className="block rounded-[var(--radius-caja)] border border-linea bg-papel p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-lg font-bold">{v.nombre}</p>
                      <p className="text-sm text-suave">{TIPO[v.tipo]} · {v.patente}</p>
                    </div>
                    <Insignia tono={ESTADO_VEHICULO[v.estado].tono}>{ESTADO_VEHICULO[v.estado].texto}</Insignia>
                  </div>
                  <p className="mt-2 text-[15px]">{quien(v)}</p>
                  <div className="mt-2">{proximo(v.proximo)}</div>
                </Link>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto rounded-[var(--radius-caja)] border border-linea bg-papel lg:block">
            <table className="w-full text-left text-[15px]">
              <thead className="border-b border-linea text-xs tracking-wider text-suave uppercase">
                <tr className="[&>th]:px-4 [&>th]:py-3"><th>Vehículo</th><th>Tipo</th><th>Patente</th><th>Estado</th><th>Chofer o asignado</th><th>Próximo vencimiento</th></tr>
              </thead>
              <tbody className="divide-y divide-linea">
                {vehiculos.map((v) => (
                  <tr key={v.id} className="hover:bg-fondo/60 [&>td]:px-4 [&>td]:py-3">
                    <td className="font-semibold"><Link href={`/flota/${v.id}`} className="hover:underline">{v.nombre}</Link></td>
                    <td>{TIPO[v.tipo]}</td>
                    <td className="tabular-nums">{v.patente}</td>
                    <td><Insignia tono={ESTADO_VEHICULO[v.estado].tono}>{ESTADO_VEHICULO[v.estado].texto}</Insignia></td>
                    <td>{quien(v)}</td>
                    <td>{proximo(v.proximo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
