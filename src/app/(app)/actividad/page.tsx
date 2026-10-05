import Link from "next/link";
import type { Metadata } from "next";
import type { Rol } from "@prisma/client";
import { Activity } from "lucide-react";
import { actividad, personas } from "@/lib/actividad/consultas";
import { ROL } from "@/lib/etiquetas";
import { Pestanas, Titulo, Vacio } from "@/components/ui/basicos";
import { claseBoton } from "@/components/ui/boton";
import { cuando } from "@/lib/formato";

export const metadata: Metadata = { title: "Actividad" };

const ROLES = Object.keys(ROL) as Rol[];

export default async function PaginaActividad({ searchParams }: { searchParams: Promise<{ rol?: string; persona?: string; antes?: string }> }) {
  const q = await searchParams;
  const rol = ROLES.includes(q.rol as Rol) ? (q.rol as Rol) : undefined;
  const [{ filas, siguiente }, gente] = await Promise.all([actividad({ rol, usuarioId: q.persona, antesDe: q.antes }), personas()]);
  const persona = gente.find((g) => g.id === q.persona);
  const url = (p: Record<string, string | undefined>) => {
    const s = new URLSearchParams(Object.entries(p).filter(([, v]) => v) as [string, string][]).toString();
    return `/actividad${s ? `?${s}` : ""}`;
  };
  return (
    <div className="mx-auto max-w-4xl">
      <Titulo detalle={persona ? `Solo lo que hizo ${persona.nombre}.` : "Cada acción de cada usuario, lo último primero."}>Actividad</Titulo>
      <Pestanas items={[{ href: url({}), etiqueta: "Todos", activa: !rol }, ...ROLES.map((r) => ({ href: url({ rol: r }), etiqueta: ROL[r], activa: rol === r }))]} />
      {persona && <Link href={url({ rol })} className="mb-3 inline-block text-sm font-semibold underline">Ver de todos</Link>}
      {filas.length === 0 ? (
        <Vacio icono={<Activity className="size-10" />} titulo="Sin actividad" />
      ) : (
        <ul className="divide-y divide-linea overflow-hidden rounded-[var(--radius-caja)] border border-linea bg-papel">
          {filas.map((a) => (
            <li key={a.id} className="flex flex-col gap-0.5 px-4 py-3 lg:flex-row lg:items-baseline lg:gap-4">
              <span className="w-28 shrink-0 text-sm text-suave tabular-nums">{cuando(a.fecha)}</span>
              <span className="min-w-0 flex-1 font-medium">{a.resumen}</span>
              {a.usuarioId ? (
                <Link href={url({ persona: a.usuarioId })} className="shrink-0 text-sm text-suave underline">{a.rol ? ROL[a.rol] : "Ver persona"}</Link>
              ) : (
                <span className="shrink-0 text-sm text-suave">Sistema</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {siguiente && (
        <div className="mt-4">
          <Link href={url({ rol, persona: q.persona, antes: siguiente })} className={claseBoton("secundario")}>Ver más viejas</Link>
        </div>
      )}
    </div>
  );
}
