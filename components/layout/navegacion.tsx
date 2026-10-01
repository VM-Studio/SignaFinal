"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  AlertTriangle, Building2, CircleDollarSign, Fuel, Home, Inbox, ListOrdered, Map, PlusCircle,
  Route, ScanLine, Truck, Users, Wrench, UserCircle2, type LucideIcon,
} from "lucide-react";
import { MAX_BARRA_INFERIOR, type ItemNav, type NombreIcono } from "@/lib/navegacion";

const ICONOS: Record<NombreIcono, LucideIcon> = {
  inicio: Home, camion: Truck, lista: ListOrdered, mapa: Map, herramienta: Wrench, escanear: ScanLine,
  alerta: AlertTriangle, costos: CircleDollarSign, combustible: Fuel, obra: Building2, personas: Users,
  viajes: Route, pedir: PlusCircle, bandeja: Inbox,
};

function activo(pathname: string, href: string, items: ItemNav[]) {
  if (pathname === href) return true;
  if (href === "/inicio") return false;
  // El más específico gana (/deposito/solicitudes antes que /deposito).
  const candidatos = items.filter((i) => pathname.startsWith(i.href + "/") || pathname === i.href);
  const mejor = candidatos.sort((a, b) => b.href.length - a.href.length)[0];
  return mejor?.href === href;
}

function Contador({ n }: { n?: number }) {
  if (!n) return null;
  return (
    <span className="ml-auto rounded-full bg-critico px-1.5 py-0.5 text-[11px] font-bold leading-none text-white tabular-nums">
      {n > 99 ? "99+" : n}
    </span>
  );
}

export function BarraLateral({ items, nombre, rol, alertas }: { items: ItemNav[]; nombre: string; rol: string; alertas: number }) {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-negro text-white lg:flex">
      <Link href="/inicio" className="flex h-20 items-center px-5" aria-label="Inicio">
        <Image src="/img/logo-640.png" alt="SIGNA · Cultura en desarrollos" width={160} height={60} priority className="h-auto w-[150px]" />
      </Link>
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        <ul className="flex flex-col gap-0.5">
          {items.map((i) => {
            const Icono = ICONOS[i.icono];
            const esActivo = activo(pathname, i.href, items);
            return (
              <li key={i.href}>
                <Link
                  href={i.href}
                  aria-current={esActivo ? "page" : undefined}
                  className={`flex min-h-11 items-center gap-3 rounded-md px-3 text-[15px] font-medium ${
                    esActivo ? "bg-white text-negro" : "text-white/75 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icono className="size-5 shrink-0" />
                  {i.etiqueta}
                  {i.href === "/alertas" && <Contador n={alertas} />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <Link href="/cuenta" className="flex items-center gap-3 border-t border-white/10 px-5 py-4 hover:bg-white/5">
        <UserCircle2 className="size-8 shrink-0 text-white/70" />
        <span className="min-w-0">
          <span className="block truncate font-semibold">{nombre}</span>
          <span className="block truncate text-sm text-white/60">{rol}</span>
        </span>
      </Link>
    </aside>
  );
}

export function BarraInferior({ items, alertas }: { items: ItemNav[]; alertas: number }) {
  const pathname = usePathname();
  const visibles = items.slice(0, MAX_BARRA_INFERIOR);
  return (
    <nav className="pb-segura fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-negro text-white lg:hidden" aria-label="Principal">
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${visibles.length}, minmax(0, 1fr))` }}>
        {visibles.map((i) => {
          const Icono = ICONOS[i.icono];
          const esActivo = activo(pathname, i.href, items);
          return (
            <li key={i.href}>
              <Link
                href={i.href}
                aria-current={esActivo ? "page" : undefined}
                className={`relative flex h-16 flex-col items-center justify-center gap-1 text-[12px] font-semibold ${esActivo ? "text-white" : "text-white/55"}`}
              >
                {esActivo && <span className="absolute inset-x-5 top-0 h-[3px] rounded-b bg-white" />}
                <span className="relative">
                  <Icono className="size-6" strokeWidth={esActivo ? 2.5 : 2} />
                  {i.href === "/alertas" && alertas > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 rounded-full bg-critico px-1 text-[10px] leading-4 font-bold text-white">{alertas > 9 ? "9+" : alertas}</span>
                  )}
                </span>
                {i.etiqueta}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
