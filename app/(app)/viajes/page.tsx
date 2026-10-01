import Link from "next/link";
import type { Metadata } from "next";
import { subDays } from "date-fns";
import { Flag, Route } from "lucide-react";
import { requerirUsuario } from "@/lib/auth/usuario-actual";
import { puede } from "@/lib/permisos";
import { viajesDelPeriodo } from "@/lib/datos/costos";
import { viajeEnCursoDe } from "@/lib/datos/pedidos";
import { Cifra, Tabla, Titulo, Vacio } from "@/components/ui/basicos";
import { cuando, km, plata } from "@/lib/formato";

export const metadata: Metadata = { title: "Viajes" };

export default async function PaginaViajes() {
  const u = await requerirUsuario("viajes.ver");
  const esChofer = u.rol === "CHOFER";
  const verCosto = puede(u.rol, "costos.ver") || esChofer;
  const periodo = { desde: subDays(new Date(), 30), hasta: new Date() };
  const [viajes, enCurso] = await Promise.all([
    viajesDelPeriodo(periodo, esChofer ? { choferId: u.id } : {}),
    esChofer ? viajeEnCursoDe(u.id) : null,
  ]);
  const totalKm = viajes.reduce((a, v) => a + (v.kmRecorridos ?? 0), 0);

  return (
    <div>
      <Titulo detalle="Últimos 30 días">{esChofer ? "Mis viajes" : "Viajes"}</Titulo>

      {enCurso && (
        <Link href={`/pedidos/${enCurso.id}`} className="mb-4 flex items-center justify-between gap-3 rounded-[var(--radius-caja)] bg-negro p-4 text-white">
          <div>
            <p className="text-sm text-white/60">En viaje ahora</p>
            <p className="text-lg font-bold">Obra {enCurso.obra.nombre}</p>
          </div>
          <span className="flex min-h-[52px] items-center gap-2 rounded-[var(--radius-caja)] bg-white px-4 font-bold text-negro">
            <Flag className="size-5" /> Llegué
          </span>
        </Link>
      )}

      <div className="mb-4 grid grid-cols-2 gap-2 lg:max-w-md">
        <Cifra etiqueta="Viajes" valor={viajes.length} />
        <Cifra etiqueta="Kilómetros" valor={km(totalKm)} />
      </div>

      {viajes.length === 0 ? (
        <Vacio titulo="Sin viajes en los últimos 30 días" icono={<Route className="size-8" />} />
      ) : (
        <>
          <ul className="flex flex-col gap-2 lg:hidden">
            {viajes.map((v) => (
              <li key={v.id}>
                <Link href={`/pedidos/${v.pedido.id}`} className="block rounded-[var(--radius-caja)] border border-linea bg-papel p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold">Obra {v.obra.nombre}</p>
                    {verCosto && <p className="font-semibold tabular-nums">{plata(v.costo)}</p>}
                  </div>
                  <p className="text-suave">
                    {v.origen} · {v.vehiculo.nombre}
                  </p>
                  <p className="mt-1 text-sm text-suave">
                    {cuando(v.llegadaEn)} · {km(v.kmRecorridos)}
                    {!esChofer && ` · ${v.chofer.nombre}`}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
          <Tabla className="hidden lg:block">
            <thead>
              <tr>
                <th>Llegada</th>
                <th>Obra</th>
                <th>Desde</th>
                {!esChofer && <th>Chofer</th>}
                <th>Vehículo</th>
                <th className="text-right">Km</th>
                {verCosto && <th className="text-right">Costo</th>}
              </tr>
            </thead>
            <tbody>
              {viajes.map((v) => (
                <tr key={v.id}>
                  <td className="whitespace-nowrap text-suave">{cuando(v.llegadaEn)}</td>
                  <td className="font-semibold">
                    <Link href={`/pedidos/${v.pedido.id}`} className="hover:underline">
                      Obra {v.obra.nombre}
                    </Link>
                  </td>
                  <td>{v.origen}</td>
                  {!esChofer && <td>{v.chofer.nombre}</td>}
                  <td>{v.vehiculo.nombre}</td>
                  <td className="text-right tabular-nums">{km(v.kmRecorridos)}</td>
                  {verCosto && <td className="text-right font-semibold tabular-nums">{plata(v.costo)}</td>}
                </tr>
              ))}
            </tbody>
          </Tabla>
        </>
      )}
    </div>
  );
}
