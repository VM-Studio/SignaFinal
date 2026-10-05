"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Bell, LogOut, UserCircle2 } from "lucide-react";
import { tituloDeRuta, type Grupo, type Seccion } from "@/lib/navegacion";
import { cerrarSesion } from "@/lib/auth/acciones";
import { Hoja } from "@/components/ui/hoja";
import { ICONOS } from "./iconos";
import { EstadoPush } from "./estado-push";

export type Perfil = { nombre: string; rol: string; obras: string | null };

/**
 * Ruta hacia la que se está yendo: al tocar un ítem se marca en el acto, sin esperar
 * la respuesta del servidor. Cuando cambia la ruta real, la marca deja de valer sola.
 */
function useDestino() {
  const pathname = usePathname();
  const [pendiente, setPendiente] = useState<{ href: string; desde: string } | null>(null);
  const destino = pendiente && pendiente.desde === pathname ? pendiente.href : pathname;
  const ir = (href: string, e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return; // se abre en otra pestaña
    if (href !== pathname) setPendiente({ href, desde: pathname });
  };
  return [destino, ir] as const;
}

/** La sección activa es la más específica que coincide con la ruta. */
function seccionActiva(hrefs: string[], ruta: string) {
  const candidatas = hrefs.map((h) => h.split("?")[0]).filter((h) => ruta === h || ruta.startsWith(h + "/"));
  return candidatas.sort((a, b) => b.length - a.length)[0];
}

function Contador({ n, claro = false }: { n: number; claro?: boolean }) {
  if (!n) return null;
  return (
    <span className={`rounded-full px-1.5 text-[11px] leading-[18px] font-bold tabular-nums ${claro ? "bg-white text-negro" : "bg-critico text-white"}`}>
      {n > 99 ? "99+" : n}
    </span>
  );
}

/** Hoja del avatar: quién soy, mis obras, avisos push, mi cuenta y cerrar sesión. */
function HojaPerfil({ perfil, abierta, onCerrar }: { perfil: Perfil; abierta: boolean; onCerrar: () => void }) {
  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo="Mi cuenta">
      <div className="flex flex-col gap-4 p-4">
        <div className="flex items-center gap-3">
          <div className="grid size-14 shrink-0 place-items-center rounded-full bg-negro text-xl font-bold text-white">{perfil.nombre.slice(0, 1)}</div>
          <div className="min-w-0">
            <p className="truncate text-lg font-bold">{perfil.nombre}</p>
            <p className="text-suave">{perfil.rol}</p>
          </div>
        </div>
        {perfil.obras && (
          <div>
            <p className="text-xs font-bold tracking-wider text-suave uppercase">Obras asignadas</p>
            <p className="mt-1 font-medium">{perfil.obras}</p>
          </div>
        )}
        <EstadoPush />
        <Link href="/cuenta" onClick={onCerrar} className="flex min-h-[52px] items-center gap-3 rounded-[var(--radius-caja)] border border-linea bg-papel px-4 font-semibold">
          <UserCircle2 className="size-5" /> Mi cuenta y contraseña
        </Link>
        <form action={cerrarSesion}>
          <button className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[var(--radius-caja)] border-2 border-critico font-bold text-critico">
            <LogOut className="size-5" /> Cerrar sesión
          </button>
        </form>
      </div>
    </Hoja>
  );
}

// ─────────────────────────── Escritorio ───────────────────────────

export function BarraLateral({ grupos, perfil, avisos }: { grupos: Grupo[]; perfil: Perfil; avisos: number }) {
  const [destino, ir] = useDestino();
  const [abierta, setAbierta] = useState(false);
  const activa = seccionActiva(grupos.flatMap((g) => g.items.map((i) => i.href)), destino);
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-negro text-white lg:flex">
      <Link href="/inicio" className="block px-5 pt-6 pb-5" aria-label="Inicio">
        <Image src="/signalogo.png" alt="SIGNA · Cultura en desarrollos" width={200} height={75} priority className="h-auto w-[200px]" />
      </Link>
      <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Principal">
        {grupos.map((g, i) => (
          <div key={g.titulo ?? i} className="mt-4 first:mt-0">
            {g.titulo && <p className="px-3 pb-1 text-[11px] font-bold tracking-wider text-white/40 uppercase">{g.titulo}</p>}
            <ul className="flex flex-col gap-0.5">
              {g.items.map((s) => {
                const Icono = ICONOS[s.icono];
                const esActiva = activa === s.href.split("?")[0];
                return (
                  <li key={s.href}>
                    <Link
                      href={s.href}
                      onClick={(e) => ir(s.href, e)}
                      aria-current={esActiva ? "page" : undefined}
                      className={`flex min-h-11 items-center gap-3 rounded-md px-3 text-[15px] font-medium ${esActiva ? "bg-white text-negro" : "text-white/75 hover:bg-white/10 hover:text-white active:bg-white/20"}`}
                    >
                      <Icono className="size-5 shrink-0" />
                      <span className="flex-1">{s.titulo}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="flex items-center gap-2 border-t border-white/10 px-3 py-3">
        <button onClick={() => setAbierta(true)} className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-white/10" aria-label="Mi cuenta">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/10 font-bold">{perfil.nombre.slice(0, 1)}</span>
          <span className="min-w-0">
            <span className="block truncate font-semibold">{perfil.nombre}</span>
            <span className="block truncate text-sm text-white/60">{perfil.rol}</span>
          </span>
        </button>
        <Link href="/avisos" aria-label={`Avisos${avisos ? `: ${avisos} sin ver` : ""}`} className="relative grid size-10 shrink-0 place-items-center rounded-md text-white/75 hover:bg-white/10 hover:text-white">
          <Bell className="size-5" />
          {avisos > 0 && <span className="absolute -top-0.5 -right-0.5"><Contador n={avisos} /></span>}
        </Link>
      </div>
      <HojaPerfil perfil={perfil} abierta={abierta} onCerrar={() => setAbierta(false)} />
    </aside>
  );
}

// ─────────────────────────── Celular ───────────────────────────

export function HeaderMovil({ perfil, avisos }: { perfil: Perfil; avisos: number }) {
  const pathname = usePathname();
  const [abierta, setAbierta] = useState(false);
  const titulo = pathname === "/inicio" ? "" : tituloDeRuta(pathname);
  return (
    <header className="pt-segura sticky top-0 z-30 bg-negro text-white lg:hidden">
      <div className="flex h-14 items-center gap-2 px-3">
        <Link href="/inicio" aria-label="Inicio" className="flex min-h-11 shrink-0 items-center px-1">
          <Image src="/signalogo.png" alt="SIGNA" width={88} height={33} priority className="h-auto w-[88px]" />
        </Link>
        {titulo && (
          <>
            <span aria-hidden className="h-6 w-px bg-white/20" />
            <p className="min-w-0 flex-1 truncate text-[17px] font-semibold">{titulo}</p>
          </>
        )}
        <Link href="/avisos" aria-label={`Avisos${avisos ? `: ${avisos} sin ver` : ""}`} className="relative ml-auto grid size-11 shrink-0 place-items-center rounded-md">
          <Bell className="size-6" />
          {avisos > 0 && (
            <span className="absolute top-1 right-0.5">
              <Contador n={avisos} />
            </span>
          )}
        </Link>
        <button onClick={() => setAbierta(true)} aria-label="Mi cuenta" className="grid size-11 shrink-0 place-items-center">
          <span className="grid size-8 place-items-center rounded-full bg-white text-sm font-bold text-negro">{perfil.nombre.slice(0, 1)}</span>
        </button>
      </div>
      <HojaPerfil perfil={perfil} abierta={abierta} onCerrar={() => setAbierta(false)} />
    </header>
  );
}

export function BarraInferior({ items, mas }: { items: Seccion[]; mas: Seccion[] }) {
  const [abierto, setAbierto] = useState(false);
  const [destino, ir] = useDestino();
  const activa = seccionActiva([...items, ...mas].map((i) => i.href), destino);
  const masActivo = mas.some((m) => m.href.split("?")[0] === activa);
  const MasIcono = ICONOS.mas;
  const columnas = items.length + (mas.length ? 1 : 0);

  return (
    <>
      <nav className="pb-segura fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-negro text-white lg:hidden" aria-label="Principal">
        <ul className="grid" style={{ gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))` }}>
          {items.map((s) => {
            const Icono = ICONOS[s.icono];
            const esActiva = activa === s.href.split("?")[0];
            return (
              <li key={s.href}>
                <Link href={s.href} onClick={(e) => ir(s.href, e)} aria-current={esActiva ? "page" : undefined} className={`relative flex h-16 flex-col items-center justify-center gap-1 text-[12px] font-semibold active:bg-white/10 ${esActiva ? "text-white" : "text-white/55"}`}>
                  {esActiva && <span aria-hidden className="absolute inset-x-5 top-0 h-[3px] rounded-b bg-white" />}
                  <Icono className="size-6" strokeWidth={esActiva ? 2.5 : 2} />
                  {s.titulo}
                </Link>
              </li>
            );
          })}
          {mas.length > 0 && (
            <li>
              <button onClick={() => setAbierto(true)} aria-expanded={abierto} className={`relative flex h-16 w-full flex-col items-center justify-center gap-1 text-[12px] font-semibold ${masActivo ? "text-white" : "text-white/55"}`}>
                {masActivo && <span aria-hidden className="absolute inset-x-5 top-0 h-[3px] rounded-b bg-white" />}
                <MasIcono className="size-6" />
                Más
              </button>
            </li>
          )}
        </ul>
      </nav>

      {mas.length > 0 && (
        <Hoja abierta={abierto} onCerrar={() => setAbierto(false)} titulo="Más">
          <ul className="m-4 flex flex-col divide-y divide-linea overflow-hidden rounded-[var(--radius-caja)] border border-linea bg-papel">
            {mas.map((s) => {
              const Icono = ICONOS[s.icono];
              return (
                <li key={s.href}>
                  <Link href={s.href} onClick={(e) => { ir(s.href, e); setAbierto(false); }} className="flex min-h-14 items-center gap-3 px-4 text-[17px] font-semibold active:bg-fondo">
                    <Icono className="size-6" />
                    {s.titulo}
                  </Link>
                </li>
              );
            })}
          </ul>
        </Hoja>
      )}
    </>
  );
}
