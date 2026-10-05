"use client";

import Link from "next/link";
import { useState } from "react";
import { CloudOff, MapPin, Navigation, Package, Warehouse } from "lucide-react";
import { Insignia } from "@/components/ui/basicos";
import { useEnvios } from "@/components/layout/conexion";
import { cuando, hora, km, plata } from "@/lib/formato";
import type { ViajeDelDia } from "@/lib/viajes/consultas";
import { BotonFinalizar, BotonIniciar } from "./acciones-viaje";

function Linea({ icono, etiqueta, nombre, direccion }: { icono: React.ReactNode; etiqueta: string; nombre: string; direccion: string }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 shrink-0 text-suave">{icono}</span>
      <p className="min-w-0">
        <span className="font-semibold">{etiqueta}:</span> {nombre}
        {direccion && <span className="block text-sm text-suave">{direccion}</span>}
      </p>
    </div>
  );
}

/** Un viaje del día del chofer con su ruta en tres líneas y la acción que corresponde. */
export function TarjetaViaje({ v, puedeIniciar, bloqueadoPor }: { v: ViajeDelDia; puedeIniciar: boolean; bloqueadoPor?: string }) {
  const envios = useEnvios();
  const [local, setLocal] = useState<{ estado: "EN_CURSO" | "FINALIZADO"; kmSalida?: number } | null>(null);

  // Lo guardado sin señal manda sobre lo que dice el servidor (todavía no le llegó).
  const salidaPendiente = envios.find((e) => e.pedidoId === v.pedidoId && e.tipo === "viaje.iniciar");
  const llegadaPendiente = envios.find((e) => e.pedidoId === v.pedidoId && e.tipo === "viaje.finalizar");
  const estado = llegadaPendiente || local?.estado === "FINALIZADO" ? "FINALIZADO" : salidaPendiente || local?.estado === "EN_CURSO" ? "EN_CURSO" : v.estado;
  const kmSalida = local?.kmSalida ?? (salidaPendiente?.datos.kmSalida as number | undefined) ?? v.kmSalida;
  const pendiente = !!(salidaPendiente || llegadaPendiente);
  // Si salió con otro pedido sin señal, este todavía no puede salir.
  const otroEnCursoLocal = envios.some(
    (e) => e.tipo === "viaje.iniciar" && e.pedidoId !== v.pedidoId && !envios.some((f) => f.tipo === "viaje.finalizar" && f.pedidoId === e.pedidoId),
  );
  // Si el viaje en curso ya se terminó sin señal (llegada guardada en el teléfono), este puede salir.
  const enCursoTerminadoLocal = !!bloqueadoPor && envios.some((e) => e.tipo === "viaje.finalizar" && e.pedidoId === bloqueadoPor);
  const habilitado = (puedeIniciar || enCursoTerminadoLocal) && !otroEnCursoLocal;

  const enCurso = estado === "EN_CURSO";
  return (
    <li id={v.pedidoId} className={`scroll-mt-24 overflow-hidden rounded-[var(--radius-caja)] border bg-papel ${enCurso ? "border-2 border-negro" : "border-linea"}`}>
      <div className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 ${enCurso ? "bg-negro text-white" : "bg-fondo"}`}>
        <p className="text-sm font-semibold">
          {estado === "EN_CURSO" && "En curso"}
          {estado === "PROGRAMADO" && `Sale ${v.salidaEstimada ? cuando(v.salidaEstimada) : "—"}`}
          {estado === "FINALIZADO" && `Entregado ${v.llegadaReal ? hora(v.llegadaReal) : ""}`}
          {" · "}
          {v.vehiculo.nombre}
        </p>
        <div className="flex gap-1.5">
          {pendiente && (
            <Insignia tono="aviso">
              <CloudOff className="size-3.5" /> Pendiente de envío
            </Insignia>
          )}
          {v.prioridad === "URGENTE" && estado !== "FINALIZADO" && <Insignia tono="critico">Urgente</Insignia>}
        </div>
      </div>

      <div className="flex flex-col gap-3 p-4">
        <Link href={`/viaje/${v.pedidoId}`} className="text-lg leading-snug font-bold hover:underline">
          {v.descripcion}
        </Link>
        <div className="flex flex-col gap-2">
          {v.desde && estado !== "FINALIZADO" && <Linea icono={<Warehouse className="size-5" />} etiqueta="Desde" nombre={v.desde.nombre} direccion="" />}
          {v.retiro && <Linea icono={<Package className="size-5" />} etiqueta="Retirar en" nombre={v.retiro.nombre} direccion={v.retiro.direccion} />}
          <Linea icono={<MapPin className="size-5" />} etiqueta="Entregar en" nombre={v.destino.nombre} direccion={v.destino.direccion} />
        </div>

        {estado === "FINALIZADO" ? (
          <p className="text-suave">
            {v.kmLlegada != null && v.kmSalida != null ? `${km(v.kmLlegada - v.kmSalida)} · ` : ""}
            {v.costo != null ? `${plata(v.costo)} a ${v.destino.nombre}` : pendiente ? "Se calcula al enviar" : ""}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <a href={v.maps} target="_blank" rel="noopener" className="flex min-h-[52px] items-center justify-center gap-2 rounded-[var(--radius-caja)] border-2 border-negro font-semibold">
              <Navigation className="size-5" /> Abrir en Maps
            </a>
            {estado === "EN_CURSO" && (
              <BotonFinalizar pedidoId={v.pedidoId} numero={v.numero} obra={v.destino.nombre.replace(/^Obra /, "")} kmSalida={kmSalida ?? null} onGuardadoLocal={() => setLocal({ estado: "FINALIZADO" })} />
            )}
            {estado === "PROGRAMADO" &&
              (habilitado ? (
                <BotonIniciar pedidoId={v.pedidoId} numero={v.numero} vehiculo={v.vehiculo.nombre} kmActual={v.vehiculo.kmActual} onGuardadoLocal={(k) => setLocal({ estado: "EN_CURSO", kmSalida: k })} />
              ) : (
                <p className="text-sm text-suave">Terminá el viaje en curso para salir con este.</p>
              ))}
          </div>
        )}
      </div>
    </li>
  );
}
