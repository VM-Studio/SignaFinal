import Link from "next/link";
import { ChevronRight, MessageSquareText, Paperclip, Truck } from "lucide-react";
import type { FilaMaterial } from "@/lib/materiales/consultas";
import { ESTADO_MATERIAL, fraseMaterial, haceDias, nroOC } from "@/lib/materiales/presentacion";
import { aFecha, diaISO, paraElDia, sumarDias } from "@/lib/formato";
import { Insignia } from "@/components/ui/basicos";
import { BotonLink } from "@/components/ui/boton";

/** Fecha sin hora (@db.Date) → "para mañana". */
const para = (iso: string) => paraElDia(aFecha(iso.slice(0, 10), "12:00"));
const primerRenglon = (d: string) => {
  const r = d.split("\n");
  return r.length > 1 ? `${r[0]} y ${r.length - 1} más` : r[0];
};

const TERMINADOS = ["ENTREGADO", "CANCELADO"];
/** Fecha de caducidad: hoy o vencida en rojo, mañana en ámbar (lo que todavía no se entregó). */
function claseCaducidad(f: FilaMaterial) {
  if (TERMINADOS.includes(f.estado)) return "";
  const d = f.paraCuando.slice(0, 10);
  const hoy = diaISO();
  if (d <= hoy) return "font-medium text-critico";
  if (d === sumarDias(hoy, 1)) return "font-medium text-aviso-texto";
  return "";
}

/** Clip con la cantidad de archivos y nota si trae observaciones. */
function Marcas({ f }: { f: FilaMaterial }) {
  if (!f.adjuntos && !f.conNota) return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-suave">
      {f.adjuntos > 0 && <span className="inline-flex items-center gap-0.5 text-[12px] tabular-nums" title={`${f.adjuntos} ${f.adjuntos === 1 ? "archivo adjunto" : "archivos adjuntos"}`}><Paperclip aria-hidden className="size-3.5" />{f.adjuntos}<span className="sr-only"> adjuntos</span></span>}
      {f.conNota && <span title="Tiene observaciones"><MessageSquareText aria-hidden className="size-3.5" /><span className="sr-only">Con observaciones</span></span>}
    </span>
  );
}

/** Cola de Compras: filas en el celular, tabla en escritorio. En rojo lo demorado. */
export function ColaMateriales({ filas, base = "/compras", compacta = false, sinMarco = false }: { filas: FilaMaterial[]; base?: string; compacta?: boolean; sinMarco?: boolean }) {
  return (
    <>
      <ul className={`divide-y divide-linea overflow-hidden border-linea bg-papel ${sinMarco ? "" : compacta ? "rounded-[var(--radius-caja)] border" : "-mx-4 border-y lg:hidden"}`}>
        {filas.map((f) => (
          <li key={f.id} data-vivo-id={f.id}>
            <Link href={`${base}/${f.id}`} className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-hover">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2"><span className="truncate font-medium">{primerRenglon(f.descripcion)}</span><Marcas f={f} /></p>
                <p className="truncate text-sm text-suave">#{f.numero} · Obra {f.obra} · {f.solicitante} · <span className={claseCaducidad(f)}>{para(f.paraCuando)}</span></p>
                <p className={`text-sm ${f.demorado ? "font-medium text-critico" : "text-suave"}`}>{f.demorado ? "Demorado · " : ""}En este paso {haceDias(new Date(f.enEstadoDesde))}</p>
              </div>
              {f.prioridad === "URGENTE" && <Insignia tono="critico">Urgente</Insignia>}
              <ChevronRight aria-hidden className="size-4 shrink-0 text-apagado" />
            </Link>
          </li>
        ))}
      </ul>
      <div className={`hidden overflow-x-auto rounded-[var(--radius-caja)] border border-linea bg-papel ${compacta ? "" : "lg:block"}`}>
        <table className="tabla tabla-56">
          <thead>
            <tr>
              <th>N°</th><th>Qué</th><th>Obra</th><th>Pidió</th>
              <th>Caducidad</th><th>Estado</th><th>En este paso</th><th>OC</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.id} data-vivo-id={f.id}>
                <td className="tabular-nums"><Link href={`${base}/${f.id}`} className="font-medium text-suave hover:text-tinta">#{f.numero}</Link></td>
                <td className="max-w-[320px]">
                  <span className="flex items-center gap-2"><Link href={`${base}/${f.id}`} className="truncate font-medium hover:underline">{primerRenglon(f.descripcion)}</Link><Marcas f={f} />{f.prioridad === "URGENTE" && <Insignia tono="critico">Urgente</Insignia>}</span>
                </td>
                <td>Obra {f.obra}</td>
                <td>{f.solicitante}</td>
                <td className={claseCaducidad(f)}>{para(f.paraCuando).replace(/^para /, "")}</td>
                <td><Insignia tono={ESTADO_MATERIAL[f.estado].tono}>{ESTADO_MATERIAL[f.estado].titulo}</Insignia></td>
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
          <li key={f.id} data-vivo-id={f.id} className="flex flex-col lg:flex-row lg:items-center">
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
