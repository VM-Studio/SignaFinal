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
            <Link href={`${base}/${f.id}`} className={`flex min-h-14 items-center gap-3 px-4 py-2 lg:min-h-11 hover:bg-hover ${f.demorado ? "" : ""}`}>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{primerRenglon(f.descripcion)}</p>
                <p className="truncate text-sm text-suave">#{f.numero} · Obra {f.obra} · {f.solicitante} · {para(f.paraCuando)}</p>
                <p className={`text-sm ${f.demorado ? "font-medium text-critico" : "text-suave"}`}>{f.demorado ? "Demorado · " : ""}En este paso {haceDias(new Date(f.enEstadoDesde))}</p>
              </div>
              {f.prioridad === "URGENTE" && <Insignia tono="critico">Urgente</Insignia>}
              <ChevronRight aria-hidden className="size-4 shrink-0 text-apagado" />
            </Link>
          </li>
        ))}
      </ul>
      <div className={`hidden overflow-hidden rounded-[var(--radius-caja)] border border-linea bg-papel ${compacta ? "" : "lg:block"}`}>
        <table className="tabla">
          <thead>
            <tr>
              <th>N°</th><th>Qué</th><th>Obra</th><th>Pidió</th>
              <th>Para cuándo</th><th>En este paso</th><th>OC</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.id} >
                <td className="tabular-nums"><Link href={`${base}/${f.id}`} className="font-medium text-suave hover:text-tinta">#{f.numero}</Link></td>
                <td className="max-w-[320px]">
                  <span className="flex items-center gap-2"><Link href={`${base}/${f.id}`} className="truncate font-medium hover:underline">{primerRenglon(f.descripcion)}</Link>{f.prioridad === "URGENTE" && <Insignia tono="critico">Urgente</Insignia>}</span>
                </td>
                <td>Obra {f.obra}</td>
                <td>{f.solicitante}</td>
                <td>{para(f.paraCuando).replace(/^para /, "")}</td>
                <td className={f.demorado ? "font-medium text-critico" : ""}>{f.demorado ? "Demorado · " : ""}{haceDias(new Date(f.enEstadoDesde))}</td>
                <td className="text-suave">{nroOC(f.ordenCompra) ?? "—"}</td>
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
    <ul className="-mx-4 divide-y divide-linea border-y border-linea bg-papel lg:mx-0 lg:overflow-hidden lg:rounded-[var(--radius-caja)] lg:border">
      {filas.map((f) => {
        const listo = !!f.listoId;
        const frase = fraseMaterial(listo ? "LISTO_PARA_RETIRAR" : f.estado, { proveedor: f.proveedorListo, llega: f.llega });
        return (
          <li key={f.id} className="flex flex-col lg:flex-row lg:items-center">
            <Link href={`/mis-pedidos/material/${f.id}`} className="flex min-h-14 min-w-0 flex-1 items-center gap-3 px-4 py-2.5 hover:bg-hover">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{primerRenglon(f.descripcion)}</p>
                <p className="truncate text-sm text-suave">Obra {f.obra} · {f.solicitante} · {para(f.paraCuando)}</p>
                {listo ? <p className="mt-0.5 text-sm font-medium text-ok">{frase}</p> : <p className="mt-0.5 text-sm">{frase}</p>}
              </div>
              {!listo && <Insignia tono={ESTADO_MATERIAL[f.estado].tono}>{ESTADO_MATERIAL[f.estado].titulo}</Insignia>}
              <ChevronRight aria-hidden className="size-4 shrink-0 text-apagado" />
            </Link>
            {listo && (
              <div className="px-4 pb-3 lg:p-0 lg:pr-4">
                <BotonLink href={`/pedir/retiro?obra=${f.obraId}&material=${f.listoId}`} icono={<Truck />} className="w-full lg:w-auto">Pedir el viaje</BotonLink>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
