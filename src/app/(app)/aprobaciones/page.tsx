import type { Metadata } from "next";
import Link from "next/link";
import { Stamp } from "lucide-react";
import { paraAprobar } from "@/lib/materiales/consultas";
import { haceDias, nroOC } from "@/lib/materiales/presentacion";
import { aFecha, paraElDia, plata } from "@/lib/formato";
import { Insignia, Tarjeta, Titulo, Vacio } from "@/components/ui/basicos";
import { BotonesAprobacion } from "@/components/materiales/acciones-material";

export const metadata: Metadata = { title: "Aprobaciones" };

/** El dueño aprueba (un toque, con deshacer) o rechaza con motivo las órdenes de compra. */
export default async function PaginaAprobaciones() {
  const filas = await paraAprobar(); // verifica materiales.aprobar
  return (
    <div className="mx-auto max-w-3xl">
      <Titulo siempre detalle="Órdenes de compra que armó Compras y esperan tu aprobación.">Aprobaciones</Titulo>
      {filas.length === 0 ? (
        <Vacio icono={<Stamp className="size-10" />} titulo="No hay nada para aprobar">Cuando Compras arme una orden de compra, aparece acá y te llega el aviso.</Vacio>
      ) : (
        <ul className="flex flex-col gap-3">
          {filas.map((f) => (
            <li key={f.id}>
              <Tarjeta className={`p-4 ${f.demorado ? "border-2 border-critico" : ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm font-semibold tracking-wider text-suave uppercase">{nroOC(f.ordenCompra) ?? "Sin número de OC"} · Obra {f.obra}</p>
                  {f.prioridad === "URGENTE" && <Insignia tono="critico">Urgente</Insignia>}
                </div>
                <Link href={`/compras/${f.id}`} className="mt-1 block text-lg leading-tight font-bold whitespace-pre-line underline-offset-2 hover:underline">{f.descripcion}</Link>
                <p className="mt-2 text-3xl font-bold tabular-nums">{f.monto != null ? plata(f.monto) : "Sin monto"}</p>
                <p className="mt-1 text-sm text-suave">
                  Pidió {f.solicitante} {paraElDia(aFecha(f.paraCuando.slice(0, 10), "12:00"))} · Compras: {f.comprador ?? "—"} · enviada {haceDias(new Date(f.enEstadoDesde))}
                  {f.proveedorListo ? ` · ${f.proveedorListo}` : ""}
                </p>
                <div className="mt-3"><BotonesAprobacion id={f.id} oc={f.ordenCompra} /></div>
              </Tarjeta>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
