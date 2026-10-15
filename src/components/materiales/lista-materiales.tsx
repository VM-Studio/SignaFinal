"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, MessageSquareText, Paperclip, Truck } from "lucide-react";
import type { FilaDoc } from "@/lib/materiales/consultas";
import { ESTADO_DOC, fraseDocumento, haceDias } from "@/lib/compras/documento";
import { aFecha, diaISO, paraElDia, sumarDias } from "@/lib/formato";
import { Insignia } from "@/components/ui/basicos";
import { BotonLink } from "@/components/ui/boton";
import { guardarEstadoLista } from "@/components/ui/volver";

/**
 * LISTAS DE DOCUMENTOS DE COMPRA. Bandeja de Compras (tabla a todo el ancho con lo que falta en cada uno),
 * Mis pedidos de la obra (con la frase del estado) y las tarjetas verdes "Listos para retirar". Tocar una fila
 * abre la plantilla en página completa; "Volver" vuelve a esta lista tal cual estaba (filtros y scroll).
 */
const para = (iso: string) => paraElDia(aFecha(iso.slice(0, 10), "12:00"));
const detalle = (f: FilaDoc) => (f.lineas > 1 ? `${f.detalle} y ${f.lineas - 1} más` : f.detalle);

/** Fecha de caducidad: hoy o vencida en rojo, mañana en ámbar (lo que todavía no se entregó). */
function claseCaducidad(f: FilaDoc) {
  if (!f.caducidad || f.estado === "ENTREGADA" || f.estado === "ANULADA") return "";
  const d = f.caducidad.slice(0, 10);
  const hoy = diaISO();
  if (d <= hoy) return "font-medium text-critico";
  if (d === sumarDias(hoy, 1)) return "font-medium text-aviso-texto";
  return "";
}

/** Clip con la cantidad de archivos y nota si trae observaciones. */
function Marcas({ f }: { f: FilaDoc }) {
  if (!f.adjuntos && !f.conNota) return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-suave">
      {f.adjuntos > 0 && <span className="inline-flex items-center gap-0.5 text-[12px] tabular-nums" title={`${f.adjuntos} ${f.adjuntos === 1 ? "archivo adjunto" : "archivos adjuntos"}`}><Paperclip aria-hidden className="size-3.5" />{f.adjuntos}<span className="sr-only"> adjuntos</span></span>}
      {f.conNota && <span title="Tiene observaciones"><MessageSquareText aria-hidden className="size-3.5" /><span className="sr-only">Con observaciones</span></span>}
    </span>
  );
}

const enlace = (id: string, desde: string) => `/compras/oc/${id}?desde=${desde}`;

/** Bandeja de Compras: filas en el celular, tabla en escritorio (filas de 56 px). */
export function BandejaCompras({ filas, desde }: { filas: FilaDoc[]; desde: string }) {
  const router = useRouter();
  const abrir = (id: string) => {
    guardarEstadoLista(desde);
    router.push(enlace(id, desde));
  };
  return (
    <>
      <ul className="-mx-4 divide-y divide-linea border-y border-linea bg-papel lg:hidden">
        {filas.map((f) => (
          <li key={f.id} data-vivo-id={f.id}>
            <Link href={enlace(f.id, desde)} onClick={() => guardarEstadoLista(desde)} className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-hover">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2"><span className="truncate font-medium">{detalle(f)}</span><Marcas f={f} /></p>
                <p className="truncate text-sm text-suave">{f.nombre} · Obra {f.obra} · {f.solicitante}{f.caducidad ? <> · <span className={claseCaducidad(f)}>{para(f.caducidad)}</span></> : null}</p>
                {f.faltan && <p className="truncate text-[13px] text-critico">{f.faltan}</p>}
              </div>
              {f.prioridad === "URGENTE" && <Insignia tono="critico">Urgente</Insignia>}
              <ChevronRight aria-hidden className="size-4 shrink-0 text-apagado" />
            </Link>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto rounded-[var(--radius-caja)] border border-linea bg-papel lg:block">
        <table className="tabla tabla-56">
          <thead>
            <tr><th>N°</th><th>Qué</th><th>Obra</th><th>Pidió</th><th>Caducidad</th><th>Qué falta</th><th>Estado</th><th>En este paso</th></tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.id} data-vivo-id={f.id} onClick={() => abrir(f.id)} className="cursor-pointer">
                <td className="whitespace-nowrap tabular-nums"><Link href={enlace(f.id, desde)} onClick={(e) => { e.stopPropagation(); guardarEstadoLista(desde); }} className="font-medium text-suave hover:text-tinta">{f.nombre}</Link></td>
                <td className="max-w-[340px]">
                  <span className="flex items-center gap-2"><span className="truncate font-medium">{detalle(f)}</span><Marcas f={f} />{f.prioridad === "URGENTE" && <Insignia tono="critico">Urgente</Insignia>}</span>
                  <span className="block text-[12px] text-suave">{f.conOC ? "Con OC cargada" : "Solo indicaciones"}</span>
                </td>
                <td>Obra {f.obra}</td>
                <td>{f.solicitante}</td>
                <td className={claseCaducidad(f)}>{f.caducidad ? para(f.caducidad).replace(/^para /, "") : "—"}</td>
                <td className="text-[13px] text-critico">{f.faltan?.replace(/^Faltan: /, "") ?? <span className="text-ok">Lista para enviar</span>}</td>
                <td><Insignia tono={ESTADO_DOC[f.estado].tono}>{ESTADO_DOC[f.estado].titulo}</Insignia>{f.motivoRechazo && <span className="mt-1 block text-[12px] text-critico">Rechazada</span>}</td>
                <td className={f.demorado ? "font-medium text-critico" : ""}>{f.demorado ? "Demorado · " : ""}{haceDias(new Date(f.enEstadoDesde))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Mis pedidos (obra): estado en una frase; lo listo para retirar, en verde con "Pedir el viaje". */
export function MisDocumentos({ filas, desde }: { filas: FilaDoc[]; desde: string }) {
  return (
    <ul className="-mx-4 divide-y divide-linea border-y border-linea bg-papel lg:mx-0 lg:overflow-hidden lg:rounded-[var(--radius-caja)] lg:border">
      {filas.map((f) => {
        const listo = !!f.listoId;
        const frase = fraseDocumento(f.estado, { proveedor: f.proveedorListo, retiro: f.retiro, entregaProveedor: f.entregaProveedor });
        return (
          <li key={f.id} data-vivo-id={f.id} className="flex flex-col lg:flex-row lg:items-center">
            <Link href={enlace(f.id, desde)} onClick={() => guardarEstadoLista(desde)} className="flex min-h-14 min-w-0 flex-1 items-center gap-3 px-4 py-2.5 hover:bg-hover">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{detalle(f)}</p>
                <p className="truncate text-sm text-suave">{f.nombre} · Obra {f.obra} · {f.solicitante}{f.caducidad ? ` · ${para(f.caducidad)}` : ""}</p>
                <p className={`mt-0.5 text-sm ${listo ? "font-medium text-ok" : ""}`}>{frase}{f.llega ? ` · llega ${f.llega}` : ""}</p>
              </div>
              {!listo && <Insignia tono={ESTADO_DOC[f.estado].tono}>{ESTADO_DOC[f.estado].titulo}</Insignia>}
              <ChevronRight aria-hidden className="size-4 shrink-0 text-apagado" />
            </Link>
            {listo && f.obraId && (
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

export type ListoTarjeta = { id: string; obraId: string; obra: string; proveedor: string; descripcion: string; horario: string | null; documentoId: string; documento: string };

/** "Listos para retirar": tarjetas verdes fijas arriba, cada una con "Pedir el viaje" (abre el pedido con ese material marcado). */
export function TarjetasListos({ listos }: { listos: ListoTarjeta[] }) {
  return (
    <ul className="grid gap-2 lg:grid-cols-2 lg:gap-4">
      {listos.map((m) => (
        <li key={m.id} className="flex flex-col gap-3 rounded-[var(--radius-caja)] border border-[#B9DCC7] bg-[#E2EFDA] p-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold tracking-[0.06em] text-[#375623] uppercase">Listo para retirar</p>
            <p className="mt-1 font-medium">{m.descripcion}</p>
            <p className="text-sm text-[#375623]">Obra {m.obra} · en {m.proveedor}{m.horario ? ` · ${m.horario}` : ""} · <Link href={enlace(m.documentoId, "mis-pedidos")} className="underline">{m.documento}</Link></p>
          </div>
          <BotonLink href={`/pedir/retiro?obra=${m.obraId}&material=${m.id}`} icono={<Truck />}>Pedir el viaje</BotonLink>
        </li>
      ))}
    </ul>
  );
}

/** Borradores de quien pide: "Seguir completando". */
export function Borradores({ filas, desde }: { filas: FilaDoc[]; desde: string }) {
  return (
    <ul className="-mx-4 divide-y divide-linea border-y border-linea bg-papel lg:mx-0 lg:overflow-hidden lg:rounded-[var(--radius-caja)] lg:border">
      {filas.map((f) => (
        <li key={f.id}>
          <Link href={enlace(f.id, desde)} onClick={() => guardarEstadoLista(desde)} className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-hover">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{f.detalle === "materiales" ? `${f.tipo === "PE" ? "Pedido especial" : "Orden de compra"} sin detalle` : detalle(f)}</p>
              <p className="truncate text-sm text-suave">{f.nombre} · {f.obra === "sin obra" ? "sin obra" : `Obra ${f.obra}`}{f.notaDevolucion ? ` · Compras: "${f.notaDevolucion}"` : ""}</p>
              {f.faltan && <p className="text-[13px] text-critico">{f.faltan}</p>}
            </div>
            <span className="shrink-0 text-sm font-medium underline">Seguir completando</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
