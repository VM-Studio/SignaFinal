"use client";

import { CotizacionDolar } from "@/components/compras/cotizacion-dolar";
import { useCantidadAvisos } from "./avisos-en-vivo";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Bell, ChevronDown, LogOut, UserCircle2 } from "lucide-react";
import { BotonActualizar } from "./actualizar";
import { tituloDeRuta, type ClaveContador, type Grupo, type Seccion } from "@/lib/navegacion";
import { FormularioSalir } from "@/components/layout/salir";
import { Hoja } from "@/components/ui/hoja";
import { claseBoton } from "@/components/ui/boton";
import { ICONOS } from "./iconos";
import { EstadoPush } from "./estado-push";
import { useContador, useLeerContador } from "./contadores";

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
  // Un documento de compra se abre desde el tablero: no marca "Pedidos de material" por empezar con /compras.
  if (ruta.startsWith("/compras/oc/") && hrefs.some((h) => h.split("?")[0] === "/compras/tablero")) return "/compras/tablero";
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

function ItemLateral({ s, activa, ir }: { s: Seccion; activa: string | undefined; ir: (href: string, e: React.MouseEvent) => void }) {
  const Icono = ICONOS[s.icono];
  const n = useContador(s.contador);
  // Un acceso con parámetros ("Buscar" → /herramientas?buscar=1) no se marca como sección activa.
  const esActiva = !s.href.includes("?") && activa === s.href.split("?")[0];
  return (
    <li>
      <Link
        href={s.href}
        onClick={(e) => ir(s.href, e)}
        aria-current={esActiva ? "page" : undefined}
        className={`flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] ${esActiva ? "bg-white/10 font-medium text-white" : "text-white/70 hover:bg-white/[0.06] hover:text-white"}`}
      >
        <Icono className="size-4 shrink-0" />
        <span className="flex-1 truncate">{s.titulo}</span>
        <Contador n={n} />
      </Link>
    </li>
  );
}

/**
 * Barra lateral negra (escritorio): los más usados arriba (los mismos de la barra del celular) y el
 * resto en "Más", plegado (se abre solo si la pantalla actual está ahí).
 */
export function BarraLateral({ principales, mas }: { principales: Seccion[]; mas: Grupo[] }) {
  const [destino, ir] = useDestino();
  const todos = [...principales, ...mas.flatMap((g) => g.items)];
  const activa = seccionActiva(todos.map((i) => i.href), destino);
  // Inicio está en "Más" pero se llega con el logo: estar en el inicio no abre "Más".
  const enMas = activa !== "/inicio" && mas.some((g) => g.items.some((i) => i.href.split("?")[0] === activa)) && !principales.some((i) => i.href.split("?")[0] === activa);
  const [abierto, setAbierto] = useState(enMas);
  const verMas = abierto || enMas;
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[232px] flex-col bg-negro text-white lg:flex">
      <Link href="/inicio" className="flex h-16 shrink-0 items-center px-5" aria-label="Inicio">
        <Image src="/marca/signa.png" alt="SIGNA · Cultura en desarrollos" width={1042} height={278} priority unoptimized className="h-auto w-[120px]" />
      </Link>
      <nav className="flex-1 overflow-y-auto px-3 pt-2 pb-4" aria-label="Principal">
        <ul className="flex flex-col gap-px">
          {principales.map((s) => <ItemLateral key={s.href} s={s} activa={activa} ir={ir} />)}
        </ul>
        {mas.length > 0 && (
          <div className="mt-5">
            <button type="button" onClick={() => setAbierto(!verMas)} aria-expanded={verMas} className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-[11px] font-medium tracking-[0.06em] text-white/45 uppercase hover:text-white/70">
              Más <ChevronDown className={`ml-auto size-3.5 transition-transform ${verMas ? "rotate-180" : ""}`} />
            </button>
            {verMas && mas.map((g, i) => (
              <div key={g.titulo ?? i} className="mt-3 first:mt-1">
                {g.titulo && <p className="px-2 pb-1 text-[11px] text-white/35">{g.titulo}</p>}
                <ul className="flex flex-col gap-px">
                  {g.items.map((s) => <ItemLateral key={s.href} s={s} activa={activa} ir={ir} />)}
                </ul>
              </div>
            ))}
          </div>
        )}
      </nav>
    </aside>
  );
}

/**
 * Header blanco de 64px del escritorio (igual para todos los roles). A la izquierda, el nombre de la sección (si la
 * página tiene <Titulo>, lo tapa con su título y sus acciones); a la derecha, el dólar (si lo ve), Actualizar,
 * campana y avatar de 40px, separados 12px.
 */
export function HeaderEscritorio({ perfil, secciones, dolar = false }: { perfil: Perfil; secciones: Seccion[]; dolar?: boolean }) {
  const pathname = usePathname();
  const [abierta, setAbierta] = useState(false);
  return (
    <header className="fixed top-0 right-0 left-[232px] z-20 hidden h-[var(--alto-header)] items-center gap-3 border-b border-linea bg-papel pr-6 pl-6 lg:flex">
      <p className="min-w-0 flex-1 truncate text-[22px] leading-7 font-semibold">{tituloDeRuta(pathname, secciones)}</p>
      {dolar && <CotizacionDolar variante="pildora" />}
      <BotonActualizar className="size-10 text-suave hover:bg-black/[0.04] hover:text-tinta disabled:opacity-100" iconos="size-[18px]" />
      <Campana className="size-10 text-suave hover:bg-black/[0.04] hover:text-tinta" iconos="size-[18px]" />
      <button onClick={() => setAbierta(true)} aria-label={`Mi cuenta: ${perfil.nombre}`} title={`${perfil.nombre} · ${perfil.rol}`} className="grid size-10 place-items-center rounded-md hover:bg-black/[0.04]">
        <span className="grid size-8 place-items-center rounded-full bg-negro text-[13px] font-semibold text-white">{perfil.nombre.slice(0, 1)}</span>
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
    <header className="pt-segura px-segura sticky top-0 z-30 bg-negro text-white lg:hidden">
      <div className="flex h-[var(--alto-header-movil)] items-center gap-3 pr-2 pl-4">
        <Link href="/inicio" aria-label="Inicio" className="flex h-12 shrink-0 items-center">
          <Image src="/marca/signa.png" alt="SIGNA" width={1042} height={278} priority unoptimized className="h-auto w-[84px]" />
        </Link>
        {titulo && (
          <>
            <span aria-hidden className="h-6 w-px shrink-0 bg-white/20" />
            <p className="min-w-0 flex-1 truncate text-[17px] font-semibold">{titulo}</p>
          </>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <BotonActualizar className="size-11 disabled:opacity-100" iconos="size-[22px]" oscuro />
          <Campana className="size-11" iconos="size-[22px]" />
          <button onClick={() => setAbierta(true)} aria-label="Mi cuenta" className="grid size-11 shrink-0 place-items-center">
            <span className="grid size-8 place-items-center rounded-full bg-white text-[14px] font-semibold text-negro">{perfil.nombre.slice(0, 1)}</span>
          </button>
        </div>
      </div>
      <HojaPerfil perfil={perfil} abierta={abierta} onCerrar={() => setAbierta(false)} />
    </header>
  );
}

function ItemBarra({ s, activa, ir }: { s: Seccion; activa: string | undefined; ir: (href: string, e: React.MouseEvent) => void }) {
  const Icono = ICONOS[s.icono];
  const n = useContador(s.contador);
  const esActiva = !s.href.includes("?") && activa === s.href.split("?")[0];
  return (
    <li>
      <Link href={s.href} onClick={(e) => ir(s.href, e)} aria-current={esActiva ? "page" : undefined} className={`relative flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium active:bg-white/10 ${esActiva ? "text-white" : "text-white/55"}`}>
        <span className="relative">
          <Icono className="size-[22px]" strokeWidth={esActiva ? 2 : 1.75} />
          {n > 0 && <span className="absolute -top-1.5 -right-2.5 ring-2 ring-negro rounded-full"><Contador n={n} /></span>}
        </span>
        {s.titulo}{n > 0 && <span className="sr-only"> ({n} pendientes)</span>}
      </Link>
    </li>
  );
}

function TarjetaMas({ s, onIr }: { s: Seccion; onIr: (e: React.MouseEvent) => void }) {
  const Icono = ICONOS[s.icono];
  const n = useContador(s.contador);
  return (
    <li>
      <Link href={s.href} onClick={onIr} className="relative flex min-h-20 flex-col justify-between gap-2 rounded-[var(--radius-caja)] border border-linea bg-papel p-3 active:bg-fondo">
        <Icono className="size-5 text-suave" strokeWidth={1.75} />
        <span className="text-[15px] leading-tight font-medium">{s.titulo}</span>
        {n > 0 && <span className="absolute top-2.5 right-2.5"><Contador n={n} /></span>}
      </Link>
    </li>
  );
}

/**
 * Barra inferior del celular (56px): los 3 más usados del rol + "Más". "Más" es una grilla de tarjetas
 * (dos columnas) con ícono, nombre y contador, y al pie Mi cuenta y Cerrar sesión.
 */
export function BarraInferior({ items, mas: todos }: { items: Seccion[]; mas: Grupo[] }) {
  // Mi cuenta va al pie de "Más": no se repite como tarjeta.
  const grupos = todos.map((g) => ({ ...g, items: g.items.filter((s) => s.href !== "/cuenta") })).filter((g) => g.items.length > 0);
  const mas = grupos.flatMap((g) => g.items);
  const [abierto, setAbierto] = useState(false);
  const [destino, ir] = useDestino();
  const activa = seccionActiva([...items, ...mas].map((i) => i.href), destino);
  const masActivo = activa !== "/inicio" && mas.some((m) => m.href.split("?")[0] === activa) && !items.some((m) => m.href.split("?")[0] === activa);
  const MasIcono = ICONOS.mas;
  const pendientesMas = mas.map((m) => m.contador).filter(Boolean) as ClaveContador[];
  const columnas = items.length + 1;

  return (
    <>
      <nav className="pb-segura px-segura fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-negro text-white lg:hidden" aria-label="Principal">
        <ul className="grid" style={{ gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))` }}>
          {items.map((s) => <ItemBarra key={s.href} s={s} activa={activa} ir={ir} />)}
          <li>
            <button onClick={() => setAbierto(true)} aria-expanded={abierto} className={`relative flex h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${masActivo ? "text-white" : "text-white/55"}`}>
              <span className="relative">
                <MasIcono className="size-[22px]" />
                <PuntoMas claves={pendientesMas} />
              </span>
              Más
            </button>
          </li>
        </ul>
      </nav>

      <Hoja abierta={abierto} onCerrar={() => setAbierto(false)} titulo="Más">
        <div className="flex flex-col gap-4">
          {grupos.map((g, i) => (
            <section key={g.titulo ?? i}>
              {g.titulo && <p className="etiqueta mb-2 px-1">{g.titulo}</p>}
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {g.items.map((s) => <TarjetaMas key={s.href} s={s} onIr={(e) => { ir(s.href, e); setAbierto(false); }} />)}
              </ul>
            </section>
          ))}
          <div className="mt-2 grid grid-cols-2 gap-2 border-t border-linea pt-4">
            <Link href="/cuenta" onClick={(e) => { ir("/cuenta", e); setAbierto(false); }} className="flex min-h-12 items-center gap-2 rounded-[var(--radius-caja)] border border-linea bg-papel px-3 text-[15px] font-medium">
              <UserCircle2 className="size-5 text-suave" /> Mi cuenta
            </Link>
            <FormularioSalir>
              <button className="flex min-h-12 w-full items-center gap-2 rounded-[var(--radius-caja)] border border-linea bg-papel px-3 text-[15px] font-medium text-critico">
                <LogOut className="size-5" /> Cerrar sesión
              </button>
            </FormularioSalir>
          </div>
        </div>
      </Hoja>
    </>
  );
}

/** Punto en "Más" si alguna de sus secciones tiene algo pendiente. */
function PuntoMas({ claves }: { claves: ClaveContador[] }) {
  const leer = useLeerContador();
  const algo = claves.some((c) => leer(c) > 0);
  return algo ? <span aria-label="Hay pendientes" className="absolute -top-0.5 -right-1 size-2 rounded-full bg-critico ring-2 ring-negro" /> : null;
}
