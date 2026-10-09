import Link from "next/link";
import { ChevronRight, Truck } from "lucide-react";
import type { FilaMaterial } from "@/lib/materiales/consultas";
import { ESTADO_MATERIAL, fraseMaterial, haceDias, nroOC } from "@/lib/materiales/presentacion";
import { aFecha, paraElDia } from "@/lib/formato";
import { Insignia } from "@/components/ui/basicos";
import { BotonLink } from "@/components/ui/boton";

/** Fecha sin hora (@db.Date) → "para mañana". */
const para = (iso: string) => paraElDia(aFecha(iso.slice(0, 10), "12:00"));
const primerRenglon = (d: string) => {
  const r = d.split("\n");
  return r.length > 1 ? `${r[0]} y ${r.length - 1} más` : r[0];
};

/** Cola de Compras: filas en el celular, tabla en escritorio. En rojo lo demorado. */
export function ColaMateriales({ filas, base = "/compras", compacta = false }: { filas: FilaMaterial[]; base?: string; compacta?: boolean }) {
  return (
    <>
      <ul className={`divide-y divide-linea overflow-hidden rounded-[var(--radius-caja)] border border-linea bg-papel ${compacta ? "" : "lg:hidden"}`}>
        {filas.map((f) => (
          <li key={f.id}>
            <Link href={`${base}/${f.id}`} className={`flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-fondo ${f.demorado ? "border-l-4 border-critico" : ""}`}>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{primerRenglon(f.descripcion)}</p>
                <p className="truncate text-sm text-suave">#{f.numero} · Obra {f.obra} · {f.solicitante} · {para(f.paraCuando)}</p>
                <p className={`text-sm ${f.demorado ? "font-semibold text-critico" : "text-suave"}`}>{f.demorado ? "Demorado · " : ""}En este paso {haceDias(new Date(f.enEstadoDesde))}</p>
              </div>
              {f.prioridad === "URGENTE" && <Insignia tono="critico">Urgente</Insignia>}
              <ChevronRight aria-hidden className="size-5 shrink-0 text-apagado" />
            </Link>
          </li>
        ))}
      </ul>
      <div className={`hidden overflow-hidden rounded-[var(--radius-caja)] border border-linea bg-papel ${compacta ? "" : "lg:block"}`}>
        <table className="w-full text-left">
          <thead className="border-b border-linea text-xs font-semibold tracking-wider text-suave uppercase">
            <tr>
              <th className="px-4 py-3">N°</th><th className="px-4 py-3">Qué</th><th className="px-4 py-3">Obra</th><th className="px-4 py-3">Pidió</th>
              <th className="px-4 py-3">Para cuándo</th><th className="px-4 py-3">En este paso</th><th className="px-4 py-3">OC</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-linea">
            {filas.map((f) => (
              <tr key={f.id} className="hover:bg-fondo">
                <td className="px-4 py-3 tabular-nums"><Link href={`${base}/${f.id}`} className="font-semibold underline">#{f.numero}</Link></td>
                <td className="max-w-[320px] px-4 py-3">
                  <Link href={`${base}/${f.id}`} className="block truncate font-semibold">{primerRenglon(f.descripcion)}</Link>
                  {f.prioridad === "URGENTE" && <Insignia tono="critico" className="mt-1">Urgente</Insignia>}
                </td>
                <td className="px-4 py-3">Obra {f.obra}</td>
                <td className="px-4 py-3">{f.solicitante}</td>
                <td className="px-4 py-3">{para(f.paraCuando).replace(/^para /, "")}</td>
                <td className={`px-4 py-3 ${f.demorado ? "font-semibold text-critico" : ""}`}>{f.demorado ? "Demorado · " : ""}{haceDias(new Date(f.enEstadoDesde))}</td>
                <td className="px-4 py-3 text-suave">{nroOC(f.ordenCompra) ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Mis pedidos de material: estado en palabras; lo listo para retirar, en verde con "Pedir el viaje". */
export function MisMateriales({ filas }: { filas: FilaMaterial[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {filas.map((f) => {
        const listo = !!f.listoId;
        const frase = fraseMaterial(listo ? "LISTO_PARA_RETIRAR" : f.estado, { proveedor: f.proveedorListo, llega: f.llega });
        return (
          <li key={f.id} className={`overflow-hidden rounded-[var(--radius-caja)] border bg-papel ${listo ? "border-2 border-ok" : "border-linea"}`}>
            <Link href={`/mis-pedidos/material/${f.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-fondo">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{primerRenglon(f.descripcion)}</p>
                <p className="truncate text-sm text-suave">Obra {f.obra} · {f.solicitante} · {para(f.paraCuando)}</p>
                <p className={`mt-1 text-sm font-bold ${listo ? "text-ok uppercase" : ""}`}>{frase}</p>
              </div>
              {!listo && <Insignia tono={ESTADO_MATERIAL[f.estado].tono}>{ESTADO_MATERIAL[f.estado].titulo}</Insignia>}
              <ChevronRight aria-hidden className="size-5 shrink-0 text-apagado" />
            </Link>
            {listo && (
              <div className="border-t border-linea p-3">
                <BotonLink href={`/pedir/retiro?obra=${f.obraId}&material=${f.listoId}`} ancho icono={<Truck className="size-5" />}>Pedir el viaje</BotonLink>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
