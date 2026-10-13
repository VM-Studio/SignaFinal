"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { RefreshCw } from "lucide-react";
import type { EntidadCambio } from "@prisma/client";
import { useConexion, useTiempoReal, type EstadoConexion } from "./tiempo-real";

const PUNTO: Record<EstadoConexion, { clase: string; texto: string }> = {
  conectado: { clase: "bg-ok", texto: "Conectado en tiempo real" },
  reconectando: { clase: "bg-apagado", texto: "Reconectando…" },
  "sin-conexion": { clase: "bg-critico", texto: "Sin conexión: tocá Actualizar" },
};

/**
 * Botón "Actualizar" del header (a la izquierda de la campana) con el punto de conexión: verde en
 * tiempo real, gris reconectando, rojo sin conexión. Gira mientras actualiza (máximo 3 s).
 */
export function BotonActualizar({ className, iconos, oscuro = false }: { className: string; iconos: string; oscuro?: boolean }) {
  const { estado, actualizar, actualizando } = useConexion();
  const p = PUNTO[estado];
  return (
    <button
      type="button"
      onClick={() => void actualizar()}
      disabled={actualizando}
      aria-label={`Actualizar · ${p.texto}`}
      title={`Actualizar · ${p.texto}`}
      className={`relative grid shrink-0 place-items-center rounded-md ${className}`}
    >
      <RefreshCw className={`${iconos} ${actualizando ? "animate-spin" : ""}`} />
      <span aria-hidden className={`absolute right-1 bottom-1 size-2 rounded-full ring-2 ${oscuro ? "ring-negro" : "ring-papel"} ${p.clase}`} />
    </button>
  );
}

/** Qué entidades le importan a cada pantalla (por ruta). Los formularios no se refrescan solos. */
const POR_RUTA: [RegExp, EntidadCambio[]][] = [
  [/^\/compras\/[^/]+\/oc/, []],
  [/^\/(pedir|pedir-materiales)(\/|$)/, []],
  [/^\/inicio/, ["PEDIDO_VIAJE", "VIAJE", "PEDIDO_MATERIAL", "ORDEN_COMPRA", "MATERIAL_LISTO", "HERRAMIENTA", "ALERTA"]],
  [/^\/(solicitudes|hoy|viaje|viajes|viajes-en-curso)(\/|$)/, ["PEDIDO_VIAJE", "VIAJE"]],
  [/^\/mis-pedidos/, ["PEDIDO_VIAJE", "VIAJE", "PEDIDO_MATERIAL", "ORDEN_COMPRA", "MATERIAL_LISTO"]],
  [/^\/(compras|habilitados|aprobaciones|materiales)(\/|$)/, ["PEDIDO_MATERIAL", "ORDEN_COMPRA", "MATERIAL_LISTO", "PEDIDO_VIAJE"]],
  [/^\/(herramientas|entregas|sobrantes)(\/|$)/, ["HERRAMIENTA", "PEDIDO_VIAJE"]],
  [/^\/obras/, ["PEDIDO_VIAJE", "PEDIDO_MATERIAL", "HERRAMIENTA"]],
  [/^\/avisos/, ["AVISO"]],
  [/^\/alertas/, ["ALERTA"]],
  [/^\/mapa/, ["VIAJE", "PEDIDO_VIAJE"]],
  [/^\/(costos|flota)(\/|$)/, ["VIAJE"]],
];

/** Refresco selectivo de la pantalla actual (una sola declaración por ruta, en el layout). */
export function RefrescoPorRuta() {
  const pathname = usePathname();
  const entidades = POR_RUTA.find(([r]) => r.test(pathname))?.[1] ?? [];
  useTiempoReal(entidades);
  return null;
}

const UMBRAL = 72;
/** Donde arrastrar hacia abajo es otra cosa: mapas, hojas, el deslizador del chofer. */
const NO_ARRASTRAR = '.leaflet-container, [role="dialog"], [data-sin-arrastre], input, textarea, select';

/**
 * Deslizar hacia abajo para actualizar (celular, sin librerías): solo con el scroll arriba de todo, con
 * el indicador que gira; al soltar pasado el umbral, hace lo mismo que el botón Actualizar.
 */
export function TirarParaActualizar() {
  const { actualizar, actualizando } = useConexion();
  const [tiro, setTiro] = useState(0);
  const inicio = useRef<number | null>(null);
  const valor = useRef(0);

  useEffect(() => {
    if (!window.matchMedia("(pointer: coarse)").matches) return;
    const empezar = (e: TouchEvent) => {
      if (e.touches.length !== 1 || window.scrollY > 0 || (e.target as Element | null)?.closest(NO_ARRASTRAR)) return;
      inicio.current = e.touches[0].clientY;
    };
    const mover = (e: TouchEvent) => {
      if (inicio.current == null) return;
      const d = e.touches[0].clientY - inicio.current;
      if (d <= 0 || window.scrollY > 0) {
        valor.current = 0;
        setTiro(0);
        return;
      }
      valor.current = Math.min(110, d * 0.5); // resistencia
      setTiro(valor.current);
    };
    const soltar = () => {
      if (inicio.current == null) return;
      inicio.current = null;
      if (valor.current >= UMBRAL * 0.75) void actualizar();
      valor.current = 0;
      setTiro(0);
    };
    window.addEventListener("touchstart", empezar, { passive: true });
    window.addEventListener("touchmove", mover, { passive: true });
    window.addEventListener("touchend", soltar);
    window.addEventListener("touchcancel", soltar);
    return () => {
      window.removeEventListener("touchstart", empezar);
      window.removeEventListener("touchmove", mover);
      window.removeEventListener("touchend", soltar);
      window.removeEventListener("touchcancel", soltar);
    };
  }, [actualizar]);

  const visible = tiro > 8 || actualizando;
  if (!visible) return null;
  const listo = tiro >= UMBRAL * 0.75;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-[calc(56px+env(safe-area-inset-top))] z-40 flex justify-center lg:hidden" style={{ transform: `translateY(${actualizando ? 12 : tiro * 0.4}px)` }}>
      <span className="grid size-9 place-items-center rounded-full border border-linea bg-papel shadow-[0_4px_16px_rgba(0,0,0,.08)]">
        <RefreshCw className={`size-5 ${actualizando ? "animate-spin" : ""} ${listo || actualizando ? "text-tinta" : "text-suave"}`} style={actualizando ? undefined : { transform: `rotate(${tiro * 3}deg)` }} />
      </span>
    </div>
  );
}
