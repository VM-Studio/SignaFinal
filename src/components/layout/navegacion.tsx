"use client";

import { useCantidadAvisos } from "./avisos-en-vivo";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Bell, LogOut, UserCircle2 } from "lucide-react";
import { tituloDeRuta, type Grupo, type Seccion } from "@/lib/navegacion";
import { FormularioSalir } from "@/components/layout/salir";
import { Hoja } from "@/components/ui/hoja";
import { claseBoton } from "@/components/ui/boton";
import { ICONOS } from "./iconos";
import { EstadoPush } from "./estado-push";
import { useHaySolicitudesNuevas } from "@/components/pedidos/solicitudes-vistas";

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

function Contador({ n }: { n: number }) {
  if (!n) return null;
  return <span className="rounded-full bg-critico px-1 text-[10px] leading-4 font-semibold text-white tabular-nums">{n > 99 ? "99+" : n}</span>;
}

/** Hoja del avatar: quién soy, mis obras, avisos push, mi cuenta y cerrar sesión. */
function HojaPerfil({ perfil, abierta, onCerrar }: { perfil: Perfil; abierta: boolean; onCerrar: () => void }) {
  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo="Mi cuenta">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-full bg-black/[0.06] font-semibold">{perfil.nombre.slice(0, 1)}</div>
          <div className="min-w-0">
            <p className="truncate font-semibold">{perfil.nombre}</p>
            <p className="text-sm text-suave">{perfil.rol}</p>
          </div>
        </div>
        {perfil.obras && (
          <div>
            <p className="etiqueta">Obras asignadas</p>
            <p className="mt-1">{perfil.obras}</p>
          </div>
        )}
        <EstadoPush />
        <Link href="/cuenta" onClick={onCerrar} className={claseBoton("secundario", "normal", true, "justify-start")}>
          <UserCircle2 /> Mi cuenta y contraseña
        </Link>
        <FormularioSalir>
          <button className={claseBoton("peligro", "normal", true, "justify-start")}>
            <LogOut /> Cerrar sesión
          </button>
        </FormularioSalir>
      </div>
    </Hoja>
  );
}

function Campana({ className, iconos }: { className: string; iconos: string }) {
  const avisos = useCantidadAvisos(); // en vivo (avisos-en-vivo.tsx)
  return (
    <Link href="/avisos" aria-label={`Avisos${avisos ? `: ${avisos} sin ver` : ""}`} className={`relative grid shrink-0 place-items-center rounded-md ${className}`}>
      <Bell className={iconos} />
      {avisos > 0 && (
        <span className="absolute top-0.5 right-0">
          <Contador n={avisos} />
        </span>
      )}
    </Link>
  );
}

// ─────────────────────────── Escritorio ───────────────────────────

export function BarraLateral({ grupos }: { grupos: Grupo[] }) {
  const [destino, ir] = useDestino();
  const activa = seccionActiva(grupos.flatMap((g) => g.items.map((i) => i.href)), destino);
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[232px] flex-col bg-negro text-white lg:flex">
      <Link href="/inicio" className="flex h-16 shrink-0 items-center px-5" aria-label="Inicio">
        <Image src="/signalogo.png" alt="SIGNA · Cultura en desarrollos" width={120} height={45} priority className="h-auto w-[120px]" />
      </Link>
      <nav className="flex-1 overflow-y-auto px-3 pt-2 pb-4" aria-label="Principal">
        {grupos.map((g, i) => (
          <div key={g.titulo ?? i} className="mt-5 first:mt-0">
            {g.titulo && <p className="px-2 pb-1 text-[11px] font-medium tracking-[0.06em] text-white/45 uppercase">{g.titulo}</p>}
            <ul className="flex flex-col gap-px">
              {g.items.map((s) => {
                const Icono = ICONOS[s.icono];
                const esActiva = activa === s.href.split("?")[0];
                return (
                  <li key={s.href}>
                    <Link
                      href={s.href}
                      onClick={(e) => ir(s.href, e)}
                      aria-current={esActiva ? "page" : undefined}
                      className={`flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] ${esActiva ? "bg-white/10 font-medium text-white" : "text-white/70 hover:bg-white/[0.06] hover:text-white"}`}
                    >
                      <Icono className="size-4 shrink-0" />
                      <span className="flex-1 truncate">{s.titulo}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}

/**
 * Header blanco de 48px del escritorio. A la izquierda, el nombre de la sección (si la página
 * tiene <Titulo>, lo tapa con su título y sus acciones); a la derecha, la campana y el avatar.
 */
export function HeaderEscritorio({ perfil, secciones }: { perfil: Perfil; secciones: Seccion[] }) {
  const pathname = usePathname();
  const [abierta, setAbierta] = useState(false);
  return (
    <header className="fixed top-0 right-0 left-[232px] z-20 hidden h-12 items-center gap-1 border-b border-linea bg-papel pr-4 pl-6 lg:flex">
      <p className="min-w-0 flex-1 truncate text-[22px] leading-7 font-semibold">{tituloDeRuta(pathname, secciones)}</p>
      <Campana className="size-8 text-suave hover:bg-black/[0.04] hover:text-tinta" iconos="size-4" />
      <button onClick={() => setAbierta(true)} aria-label={`Mi cuenta: ${perfil.nombre}`} title={`${perfil.nombre} · ${perfil.rol}`} className="grid size-8 place-items-center rounded-md hover:bg-black/[0.04]">
        <span className="grid size-6 place-items-center rounded-full bg-negro text-[11px] font-semibold text-white">{perfil.nombre.slice(0, 1)}</span>
      </button>
      <HojaPerfil perfil={perfil} abierta={abierta} onCerrar={() => setAbierta(false)} />
    </header>
  );
}

// ─────────────────────────── Celular ───────────────────────────

export function HeaderMovil({ perfil, secciones }: { perfil: Perfil; secciones: Seccion[] }) {
  const pathname = usePathname();
  const [abierta, setAbierta] = useState(false);
  const titulo = pathname === "/inicio" ? "" : tituloDeRuta(pathname, secciones);
  return (
    <header className="pt-segura sticky top-0 z-30 bg-negro text-white lg:hidden">
      <div className="flex h-[52px] items-center gap-2 pr-1 pl-4">
        <Link href="/inicio" aria-label="Inicio" className="flex h-11 shrink-0 items-center">
          <Image src="/signalogo.png" alt="SIGNA" width={72} height={27} priority className="h-auto w-[72px]" />
        </Link>
        {titulo && (
          <>
            <span aria-hidden className="mx-1 h-5 w-px bg-white/20" />
            <p className="min-w-0 flex-1 truncate text-[15px] font-medium">{titulo}</p>
          </>
        )}
        <Campana className="ml-auto size-11" iconos="size-5" />
        <button onClick={() => setAbierta(true)} aria-label="Mi cuenta" className="grid size-11 shrink-0 place-items-center">
          <span className="grid size-7 place-items-center rounded-full bg-white text-[13px] font-semibold text-negro">{perfil.nombre.slice(0, 1)}</span>
        </button>
      </div>
      <HojaPerfil perfil={perfil} abierta={abierta} onCerrar={() => setAbierta(false)} />
    </header>
  );
}

export function BarraInferior({ items, mas: grupos, conSalir = false, nuevas }: { items: Seccion[]; mas: Grupo[]; conSalir?: boolean; nuevas?: { href: string; ultima: string | null } }) {
  const mas = grupos.flatMap((g) => g.items);
  const hayNuevas = useHaySolicitudesNuevas(nuevas?.ultima ?? null);
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
                <Link href={s.href} onClick={(e) => ir(s.href, e)} aria-current={esActiva ? "page" : undefined} className={`relative flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium active:bg-white/10 ${esActiva ? "text-white" : "text-white/55"}`}>
                  <span className="relative">
                    <Icono className="size-[22px]" strokeWidth={esActiva ? 2 : 1.75} />
                    {nuevas?.href === s.href && hayNuevas && <span aria-label="Hay nuevas" className="absolute -top-0.5 -right-1 size-2 rounded-full bg-critico ring-2 ring-negro" />}
                  </span>
                  {s.titulo}{nuevas?.href === s.href && hayNuevas && <span className="sr-only"> (hay nuevas)</span>}
                </Link>
              </li>
            );
          })}
          {mas.length > 0 && (
            <li>
              <button onClick={() => setAbierto(true)} aria-expanded={abierto} className={`relative flex h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${masActivo ? "text-white" : "text-white/55"}`}>
                <MasIcono className="size-[22px]" />
                Más
              </button>
            </li>
          )}
        </ul>
      </nav>

      {mas.length > 0 && (
        <Hoja abierta={abierto} onCerrar={() => setAbierto(false)} titulo="Más">
          <div className="flex flex-col gap-4">
            {grupos.map((g, i) => (
              <section key={g.titulo ?? i}>
                {g.titulo && <p className="etiqueta mb-1 px-1">{g.titulo}</p>}
                <ul className="flex flex-col divide-y divide-linea overflow-hidden rounded-[var(--radius-caja)] border border-linea bg-papel">
                  {g.items.map((s) => {
                    const Icono = ICONOS[s.icono];
                    return (
                      <li key={s.href}>
                        <Link href={s.href} onClick={(e) => { ir(s.href, e); setAbierto(false); }} className="flex min-h-14 items-center gap-3 px-4 text-[15px] font-medium active:bg-fondo">
                          <Icono className="size-5 text-suave" />
                          {s.titulo}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
            {conSalir && (
              <FormularioSalir>
                <button className="flex min-h-14 w-full items-center gap-3 rounded-[var(--radius-caja)] border border-linea bg-papel px-4 text-[15px] font-medium text-critico">
                  <LogOut className="size-5" /> Cerrar sesión
                </button>
              </FormularioSalir>
            )}
          </div>
        </Hoja>
      )}
    </>
  );
}
