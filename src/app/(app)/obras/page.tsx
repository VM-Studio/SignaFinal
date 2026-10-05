import Link from "next/link";
import type { Metadata } from "next";
import { Building2, ChevronRight } from "lucide-react";
import { listaObras } from "@/lib/obras/consultas";
import { Insignia, Titulo, Vacio } from "@/components/ui/basicos";

export const metadata: Metadata = { title: "Obras" };

/** Mis obras: nombre, dirección y dos números (pedidos activos y herramientas en la obra). */
export default async function PaginaObras() {
  const obras = await listaObras();
  return (
    <div className="mx-auto max-w-3xl">
      <Titulo>Obras</Titulo>
      {obras.length === 0 ? (
        <Vacio icono={<Building2 className="size-10" />} titulo="No tenés obras asignadas">Pedile a la oficina que te asigne tus obras.</Vacio>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {obras.map((o) => (
            <li key={o.id}>
              <Link href={`/obras/${o.id}`} className="flex h-full flex-col rounded-[var(--radius-caja)] border border-linea bg-papel p-4 hover:bg-fondo/60">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-lg font-bold">Obra {o.nombre}</p>
                    <p className="truncate text-sm text-suave">{o.direccion}</p>
                  </div>
                  {o.estado !== "ACTIVA" ? <Insignia tono="aviso">Pausada</Insignia> : <ChevronRight aria-hidden className="size-5 shrink-0 text-apagado" />}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-md bg-fondo px-3 py-2">
                    <p className="text-2xl font-bold tabular-nums">{o.pedidosActivos}</p>
                    <p className="text-sm text-suave">{o.pedidosActivos === 1 ? "pedido activo" : "pedidos activos"}</p>
                  </div>
                  <div className="rounded-md bg-fondo px-3 py-2">
                    <p className="text-2xl font-bold tabular-nums">{o.herramientas}</p>
                    <p className="text-sm text-suave">{o.herramientas === 1 ? "herramienta" : "herramientas"}</p>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
