import Link from "next/link";
import { FileText, Lock } from "lucide-react";
import type { OCPlana } from "@/lib/compras/consultas";
import { condicionPagoTexto, ESTADO_OC, FORMA_PAGO, importeTexto, TIPO_ORDEN } from "@/lib/compras/estados";
import { ESTADO_TABLERO } from "@/lib/compras/estadoTablero";
import type { AdjuntoPlano } from "@/lib/archivos";
import { cuando } from "@/lib/formato";
import { claseBoton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/basicos";
import { ListaAdjuntos } from "@/components/adjuntos/lista";

/**
 * La orden en el detalle del pedido de material: número grande, proveedor final y estado. Compras y el
 * dueño (completo) ven también importe, forma y condición de pago, notas internas, adjuntos y el PDF;
 * la gente de obra no ve importes (ni el PDF, que los lleva).
 */
export function BloqueOC({ oc, completo }: { oc: OCPlana & { adjuntos: AdjuntoPlano[] }; completo: boolean }) {
  const e = oc.estadoTablero ? ESTADO_TABLERO[oc.estadoTablero] : ESTADO_OC[oc.estado];
  return (
    <section className="rounded-[var(--radius-caja)] border border-linea bg-papel p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="etiqueta">{TIPO_ORDEN[oc.tipo].titulo}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{oc.numero ? `${oc.numero}${oc.versionAprobacion > 1 ? ` v${oc.versionAprobacion}` : ""}` : "Borrador (sin número)"}</p>
        </div>
        <Insignia tono={e.tono}>{e.titulo}</Insignia>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <div><dt className="etiqueta">Proveedor</dt><dd className="mt-1 font-medium">{oc.proveedor ?? oc.proveedorSugerido ?? "—"}</dd></div>
        <div className="sm:col-span-2"><dt className="etiqueta">Sucursal</dt><dd className="mt-1">{oc.sucursal ? `${oc.sucursal.nombre} · ${oc.sucursal.direccion}` : "—"}</dd></div>
        {completo && <div><dt className="etiqueta">Forma de pago</dt><dd className="mt-1">{oc.formaPago ? FORMA_PAGO[oc.formaPago] : "—"}{oc.condicionPago ? <span className="text-suave"> · {condicionPagoTexto(oc.condicionPago, oc.condicionPagoTexto)}</span> : null}</dd></div>}
        {completo && <div><dt className="etiqueta">Importe</dt><dd className="mt-1 font-medium tabular-nums">{oc.importe != null || oc.importeAConfirmar ? importeTexto(oc.importe, oc.moneda, oc.importeAConfirmar) : "—"}</dd></div>}
        {oc.aprobadaEn && <div><dt className="etiqueta">Autorizó</dt><dd className="mt-1">{oc.aprobadaPor} · <span suppressHydrationWarning>{cuando(oc.aprobadaEn)}</span></dd></div>}
        {oc.fechaEntrega && <div><dt className="etiqueta">Entrega programada</dt><dd className="mt-1">{oc.fechaEntrega.split("-").reverse().join("/")}</dd></div>}
      </dl>
      {oc.motivoRechazo && <p className="mt-3 rounded-md bg-critico-fondo px-3 py-2 text-sm text-critico">Rechazada: {oc.motivoRechazo}</p>}
      {oc.motivoAnulacion && <p className="mt-3 rounded-md bg-black/[0.04] px-3 py-2 text-sm text-suave">Anulada: {oc.motivoAnulacion}</p>}
      {completo && oc.notasInternas && <p className="mt-3 flex items-start gap-1.5 text-sm text-suave"><Lock className="mt-0.5 size-3.5 shrink-0" /> {oc.notasInternas}</p>}
      {completo && (
        <div className="mt-3 flex flex-wrap gap-2">
          {oc.estado === "APROBADA" && <a href={`/api/oc/${oc.id}/pdf?aprobada=1`} target="_blank" rel="noopener" className={claseBoton("secundario", "chico")}><FileText /> PDF autorizado</a>}
          {oc.numero && <a href={`/api/oc/${oc.id}/pdf`} target="_blank" rel="noopener" className={claseBoton("secundario", "chico")}><FileText /> {oc.estado === "APROBADA" ? "PDF original" : "Ver PDF"}</a>}
          <Link href={`/compras/ordenes?ver=${oc.id}`} className={claseBoton("fantasma", "chico")}>Ver en el tablero</Link>
        </div>
      )}
      {completo && oc.adjuntos.length > 0 && <div className="mt-3"><ListaAdjuntos adjuntos={oc.adjuntos} /></div>}
    </section>
  );
}
