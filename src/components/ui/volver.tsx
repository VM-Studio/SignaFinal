"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/**
 * "← VOLVER" QUE DEJA LA PANTALLA ANTERIOR TAL CUAL (filtros, pestaña, orden y scroll; en el tablero también
 * el scroll de la planilla). Implementado una sola vez:
 *  - La lista llama a guardarEstadoLista(clave) al abrir un detalle (URL completa + scroll), en sessionStorage
 *    y por usuario.
 *  - El detalle muestra <VolverA clave href etiqueta>: si se llegó tocando un enlace de la app, history.back()
 *    (a la lista o a la pantalla de donde vino); si no (link directo, recarga, aviso), navega a la URL guardada
 *    de la lista o al href por defecto.
 *  - La lista monta <RestaurarLista clave>: al volver, repone el scroll.
 * Para todas las demás listas lo hace solo <RecordarListas /> (en el layout): al tocar un enlace guarda la
 * pantalla actual con su ruta como clave, y al volver repone el scroll. Así cada detalle usa
 * <VolverA clave="/herramientas" href="/herramientas" etiqueta="Depósito" /> sin tocar la lista.
 */
type Estado = { url: string; y: number; planilla?: { x: number; y: number }; t: number };
const usuario = () => (typeof document === "undefined" ? "" : document.querySelector<HTMLElement>("[data-usuario]")?.dataset.usuario ?? "");
const clave = (c: string) => `signa:volver:${usuario()}:${c}`;
const VINO = "signa:volver:vino-de";
const VOLVIENDO = "signa:volver:volviendo";

function leer(c: string): Estado | null {
  try {
    const s = sessionStorage.getItem(clave(c));
    return s ? (JSON.parse(s) as Estado) : null;
  } catch {
    return null;
  }
}

/** La lista guarda cómo está antes de abrir un detalle. */
export function guardarEstadoLista(c: string) {
  try {
    const planilla = document.querySelector<HTMLElement>(".planilla");
    const e: Estado = { url: location.pathname + location.search, y: window.scrollY, planilla: planilla ? { x: planilla.scrollLeft, y: planilla.scrollTop } : undefined, t: Date.now() };
    sessionStorage.setItem(clave(c), JSON.stringify(e));
    sessionStorage.setItem(VINO, c);
  } catch {}
}

/** Cabecera de detalle: "← Volver al tablero". */
export function VolverA({ clave: c, href, etiqueta, className = "" }: { clave: string; href: string; etiqueta: string; className?: string }) {
  const router = useRouter();
  const [vino, setVino] = useState(false);
  useEffect(() => {
    try {
      // Si llegó tocando un enlace de la app (de esta lista o de otra pantalla, como la obra), vuelve atrás.
      setVino(!!sessionStorage.getItem(VINO));
    } catch {}
  }, [c]);
  const destino = () => leer(c)?.url ?? href;
  return (
    <Link
      href={href}
      onClick={(e) => {
        e.preventDefault();
        try {
          sessionStorage.setItem(VOLVIENDO, c);
          sessionStorage.removeItem(VINO);
        } catch {}
        if (vino && window.history.length > 1) router.back();
        else router.push(destino());
      }}
      className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-md pr-2 text-[13px] font-medium text-suave hover:text-tinta ${className}`}
    >
      <ArrowLeft className="size-4" /> <span className="sm:hidden">Volver</span>
      <span className="hidden sm:inline">{etiqueta}</span>
    </Link>
  );
}

/** En la lista: al volver de un detalle, repone el scroll de la página (y el de la planilla). */
export function RestaurarLista({ clave: c }: { clave: string }) {
  useRestaurar(c);
  return null;
}

/** Todas las listas: guarda la pantalla al tocar un enlace interno y la repone al volver con VolverA. */
export function RecordarListas() {
  const ruta = usePathname();
  useEffect(() => {
    const alTocar = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || e.metaKey || e.ctrlKey) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname === location.pathname) return;
      guardarEstadoLista(location.pathname);
    };
    document.addEventListener("click", alTocar, true);
    return () => document.removeEventListener("click", alTocar, true);
  }, []);
  useRestaurar(ruta);
  return null;
}

function useRestaurar(c: string) {
  useLayoutEffect(() => {
    let volviendo = false;
    try {
      volviendo = sessionStorage.getItem(VOLVIENDO) === c;
      if (volviendo) sessionStorage.removeItem(VOLVIENDO);
    } catch {}
    const e = leer(c);
    if (!volviendo || !e || e.url !== location.pathname + location.search || Date.now() - e.t > 2 * 3600_000) return;
    const reponer = () => {
      window.scrollTo(0, e.y);
      const planilla = document.querySelector<HTMLElement>(".planilla");
      if (planilla && e.planilla) {
        planilla.scrollLeft = e.planilla.x;
        planilla.scrollTop = e.planilla.y;
      }
    };
    reponer();
    // Por si la lista termina de pintar después (datos que llegan con streaming).
    const t = window.setTimeout(reponer, 120);
    return () => window.clearTimeout(t);
  }, [c]);
}
