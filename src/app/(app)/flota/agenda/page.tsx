import Link from "next/link";
import type { Metadata } from "next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { agenda, ESTADO_VEHICULO } from "@/lib/flota/consultas";
import { Insignia, Titulo, Vacio } from "@/components/ui/basicos";
import { aFecha, dia, diaISO, hora, sumarDias } from "@/lib/formato";
import { exigirSesion } from "@/lib/auth/sesion";
import { enlacePedido } from "@/lib/permisos";

export const metadata: Metadata = { title: "Agenda" };

const DESDE_H = 6;
const HASTA_H = 21;
const HORAS = Array.from({ length: HASTA_H - DESDE_H }, (_, i) => DESDE_H + i);

const COLOR = {
  EN_CURSO: "bg-tinta/[0.08] text-tinta border-tinta/30",
  PROGRAMADO: "bg-papel text-tinta border-linea border-dashed",
  FINALIZADO: "bg-ok-fondo text-ok border-ok/30",
  CANCELADO: "bg-fondo text-suave border-linea",
} as const;
const TEXTO = { EN_CURSO: "En curso", PROGRAMADO: "Programado", FINALIZADO: "Terminado", CANCELADO: "Cancelado" } as const;

export default async function PaginaAgenda({ searchParams }: { searchParams: Promise<{ dia?: string }> }) {
  const p = (await searchParams).dia;
  const elegido = p && /^\d{4}-\d{2}-\d{2}$/.test(p) ? p : diaISO();
  const [filas, u] = await Promise.all([agenda(elegido), exigirSesion()]); // agenda verifica flota.agenda
  // Sin pantalla de pedidos (Administración), el bloque lleva a los viajes del vehículo.
  const ver = (pedidoId: string, vehiculoId: string) => enlacePedido(u.rol, pedidoId) ?? `/flota/${vehiculoId}?tab=viajes`;
  const inicioDia = aFecha(elegido).getTime();
  const pos = (iso: string) => ((new Date(iso).getTime() - inicioDia) / 3_600_000 - DESDE_H) / (HASTA_H - DESDE_H);
  const clamp = (x: number) => Math.min(1, Math.max(0, x));
  const ahora = elegido === diaISO() ? clamp(pos(new Date().toISOString())) : null;
  const total = filas.reduce((a, f) => a + f.viajes.length, 0);

  const navegacion = (
    <div className="flex items-center gap-1">
      <Link href={`/flota/agenda?dia=${sumarDias(elegido, -1)}`} aria-label="Día anterior" className="grid size-11 place-items-center rounded-md border border-linea bg-papel"><ChevronLeft className="size-5" /></Link>
      <Link href="/flota/agenda" className="grid min-h-11 place-items-center rounded-md border border-linea bg-papel px-4 text-sm font-semibold">Hoy</Link>
      <Link href={`/flota/agenda?dia=${sumarDias(elegido, 1)}`} aria-label="Día siguiente" className="grid size-11 place-items-center rounded-md border border-linea bg-papel"><ChevronRight className="size-5" /></Link>
    </div>
  );

  return (
    <div>
      <Titulo siempre detalle={`${dia(aFecha(elegido, "12:00"))} · ${total} viaje${total === 1 ? "" : "s"} de los vehículos de la cola`} accion={navegacion}>
        Agenda
      </Titulo>

      {/* Escritorio: filas por vehículo, bloques por hora */}
      <div className="hidden overflow-x-auto rounded-[var(--radius-caja)] border border-linea bg-papel lg:block">
        <div className="min-w-[960px]">
          <div className="grid grid-cols-[200px_1fr] border-b border-linea">
            <div />
            <div className="relative h-9">
              {HORAS.map((h, i) => (
                <span key={h} className="absolute top-2 -translate-x-1/2 text-xs font-semibold text-suave tabular-nums" style={{ left: `${(i / HORAS.length) * 100}%` }}>{h}:00</span>
              ))}
            </div>
          </div>
          {filas.map((v) => (
            <div key={v.id} className="grid grid-cols-[200px_1fr] border-b border-linea last:border-0">
              <div className="flex flex-col justify-center gap-1 border-r border-linea px-4 py-3">
                <Link href={`/flota/${v.id}`} className="font-semibold hover:underline">{v.nombre}</Link>
                <Insignia tono={ESTADO_VEHICULO[v.estado].tono} className="w-fit">{ESTADO_VEHICULO[v.estado].texto}</Insignia>
              </div>
              <div className="relative h-20">
                {HORAS.map((h, i) => <span key={h} aria-hidden className="absolute inset-y-0 border-l border-linea/70" style={{ left: `${(i / HORAS.length) * 100}%` }} />)}
                {ahora != null && <span aria-hidden className="absolute inset-y-0 z-10 w-0.5 bg-critico" style={{ left: `${ahora * 100}%` }} />}
                {v.viajes.map((x) => {
                  const izq = clamp(pos(x.inicio));
                  const der = clamp(pos(x.fin));
                  return (
                    <Link
                      key={x.id}
                      href={ver(x.pedidoId, v.id)}
                      title={`${x.descripcion} → Obra ${x.obra} · ${x.chofer} · ${hora(x.inicio)}–${hora(x.fin)}`}
                      className={`absolute top-2 bottom-2 z-20 overflow-hidden rounded-md border px-2 py-1 text-xs leading-tight ${COLOR[x.estado]}`}
                      style={{ left: `${izq * 100}%`, width: `max(${(der - izq) * 100}%, 64px)` }}
                    >
                      <span className="block truncate font-semibold">{hora(x.inicio)} · Obra {x.obra}</span>
                      <span className="block truncate">{x.chofer} · {x.descripcion}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Celular: lista agrupada por vehículo */}
      <div className="flex flex-col gap-4 lg:hidden">
        {filas.map((v) => (
          <section key={v.id}>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <Link href={`/flota/${v.id}`} className="font-semibold">{v.nombre}</Link>
              <Insignia tono={ESTADO_VEHICULO[v.estado].tono}>{ESTADO_VEHICULO[v.estado].texto}</Insignia>
            </div>
            {v.viajes.length === 0 ? (
              <p className="rounded-[var(--radius-caja)] border border-dashed border-linea-fuerte px-4 py-3 text-sm text-suave">Libre todo el día</p>
            ) : (
              <ul className="divide-y divide-linea overflow-hidden rounded-[var(--radius-caja)] border border-linea bg-papel">
                {v.viajes.map((x) => (
                  <li key={x.id}>
                    <Link href={ver(x.pedidoId, v.id)} className="flex min-h-14 items-center gap-3 px-4 py-2 lg:min-h-11">
                      <span className="w-12 shrink-0 font-semibold tabular-nums">{hora(x.inicio)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">Obra {x.obra}</span>
                        <span className="block truncate text-sm text-suave">{x.chofer} · {x.descripcion}</span>
                      </span>
                      <Insignia tono={x.estado === "EN_CURSO" ? "activo" : x.estado === "FINALIZADO" ? "ok" : "aviso"}>{TEXTO[x.estado]}</Insignia>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
      {filas.length === 0 && <Vacio titulo="No hay vehículos en la cola" />}
    </div>
  );
}
