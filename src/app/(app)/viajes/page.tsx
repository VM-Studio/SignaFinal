import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FileImage, ListOrdered, Route } from "lucide-react";
import { exigirSesion } from "@/lib/auth/sesion";
import { puede } from "@/lib/permisos";
import { misViajes, viajesRecientes } from "@/lib/viajes/consultas";
import { BotonLink } from "@/components/ui/boton";
import { Insignia, Subtitulo, Titulo, Vacio } from "@/components/ui/basicos";
import { TarjetaViaje } from "@/components/viajes/tarjeta-viaje";
import { cuando, km, plata } from "@/lib/formato";

export const metadata: Metadata = { title: "Viajes" };

export default async function PaginaViajes() {
  const u = await exigirSesion();
  if (puede(u.rol, "viajes.verPropios")) return <MisViajes />;
  if (puede(u.rol, "viajes.verTodos")) return <TodosLosViajes />;
  redirect("/inicio?sin-permiso=1");
}

async function MisViajes() {
  const viajes = await misViajes();
  const enCurso = viajes.some((v) => v.estado === "EN_CURSO");
  const grupos = [
    { titulo: "En curso", lista: viajes.filter((v) => v.estado === "EN_CURSO") },
    { titulo: "Programados", lista: viajes.filter((v) => v.estado === "PROGRAMADO") },
    { titulo: "Terminados hoy", lista: viajes.filter((v) => v.estado === "FINALIZADO") },
  ];
  return (
    <div className="mx-auto max-w-2xl">
      <Titulo detalle="Primero el que está en curso, después los programados en orden de salida.">Mis viajes</Titulo>
      {viajes.length === 0 ? (
        <Vacio icono={<Route className="size-10" />} titulo="No tenés viajes para hoy" accion={<BotonLink href="/pedidos" icono={<ListOrdered className="size-5" />}>Ver pedidos para tomar</BotonLink>}>
          Tomá un pedido de la cola y aparece acá.
        </Vacio>
      ) : (
        grupos.map((g) =>
          g.lista.length ? (
            <section key={g.titulo}>
              <Subtitulo>{g.titulo}</Subtitulo>
              <ul className="flex flex-col gap-3">
                {g.lista.map((v) => (
                  <TarjetaViaje key={v.viajeId} v={v} puedeIniciar={!enCurso} />
                ))}
              </ul>
            </section>
          ) : null,
        )
      )}
    </div>
  );
}

const ESTADO = { EN_CURSO: { t: "En curso", tono: "activo" }, PROGRAMADO: { t: "Programado", tono: "aviso" }, FINALIZADO: { t: "Terminado", tono: "ok" }, CANCELADO: { t: "Cancelado", tono: "neutro" } } as const;

async function TodosLosViajes() {
  const viajes = await viajesRecientes();
  return (
    <div>
      <Titulo detalle="En curso, programados y terminados en los últimos 7 días.">Viajes</Titulo>
      {viajes.length === 0 ? (
        <Vacio icono={<Route className="size-10" />} titulo="Sin viajes en los últimos días" />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-caja)] border border-linea bg-papel">
          <table className="w-full min-w-[720px] text-left text-[15px]">
            <thead className="border-b border-linea text-xs tracking-wider text-suave uppercase">
              <tr className="[&>th]:px-4 [&>th]:py-3">
                <th>Estado</th><th>Qué</th><th>Obra</th><th>Chofer · Vehículo</th><th>Cuándo</th><th className="text-right">Km</th><th className="text-right">Costo</th><th />
              </tr>
            </thead>
            <tbody className="divide-y divide-linea">
              {viajes.map((v) => (
                <tr key={v.id} className="[&>td]:px-4 [&>td]:py-3">
                  <td><Insignia tono={ESTADO[v.estado].tono}>{ESTADO[v.estado].t}</Insignia></td>
                  <td className="max-w-xs"><Link href={`/pedidos/${v.pedidoId}`} className="line-clamp-2 font-semibold hover:underline">{v.descripcion}</Link></td>
                  <td>Obra {v.obra}</td>
                  <td>{v.chofer} · <span className="text-suave">{v.vehiculo}</span></td>
                  <td className="whitespace-nowrap text-suave">{cuando(v.llegadaReal ?? v.salidaReal ?? v.salidaEstimada)}</td>
                  <td className="text-right tabular-nums">{km(v.km)}</td>
                  <td className="text-right font-semibold tabular-nums">{plata(v.costo)}</td>
                  <td>{v.remitoUrl && <a href={v.remitoUrl} target="_blank" rel="noopener" aria-label="Ver remito" className="grid size-10 place-items-center"><FileImage className="size-5" /></a>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
