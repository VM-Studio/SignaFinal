import { FileText, Lock } from "lucide-react";
import type { OCPlana } from "@/lib/compras/consultas";
import { ESTADO_OC, METODO_PAGO } from "@/lib/compras/estados";
import type { AdjuntoPlano } from "@/lib/archivos";
import { cuando, plata } from "@/lib/formato";
import { claseBoton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/basicos";
import { ListaAdjuntos } from "@/components/adjuntos/lista";

/**
 * La orden de compra en el detalle del pedido: número grande, proveedor y sucursal, estado y el PDF.
 * Compras y el dueño ven todo (montos, notas internas, el historial); el que pidió, la aprobada.
 */
export function BloqueOC({ oc, completo }: { oc: OCPlana & { adjuntos: AdjuntoPlano[] }; completo: boolean }) {
  const e = ESTADO_OC[oc.estado];
  return (
    <section className="rounded-[var(--radius-caja)] border border-linea bg-papel p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="etiqueta">Orden de compra</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{oc.numero ?? "Borrador (sin número)"}</p>
        </div>
        <Insignia tono={e.tono}>{e.titulo}</Insignia>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <div><dt className="etiqueta">Proveedor</dt><dd className="mt-1 font-medium">{oc.proveedor ?? "—"}</dd></div>
        <div className="sm:col-span-2"><dt className="etiqueta">Sucursal</dt><dd className="mt-1">{oc.sucursal ? `${oc.sucursal.nombre} · ${oc.sucursal.direccion}` : "—"}</dd></div>
        {completo && <div><dt className="etiqueta">Método de pago</dt><dd className="mt-1">{oc.metodoPago ? METODO_PAGO[oc.metodoPago] : "—"}</dd></div>}
        {completo && <div><dt className="etiqueta">Total</dt><dd className="mt-1 font-medium tabular-nums">{oc.total != null ? `${oc.moneda === "USD" ? "US" : ""}${plata(oc.total)}` : "Según presupuesto"}</dd></div>}
        {oc.aprobadaEn && <div><dt className="etiqueta">Aprobó</dt><dd className="mt-1">{oc.aprobadaPor} · <span suppressHydrationWarning>{cuando(oc.aprobadaEn)}</span></dd></div>}
      </dl>
      {oc.motivoRechazo && <p className="mt-3 rounded-md bg-critico-fondo px-3 py-2 text-sm text-critico">Rechazada: {oc.motivoRechazo}</p>}
      {oc.motivoAnulacion && <p className="mt-3 rounded-md bg-black/[0.04] px-3 py-2 text-sm text-suave">Anulada: {oc.motivoAnulacion}</p>}
      {completo && oc.notasInternas && <p className="mt-3 flex items-start gap-1.5 text-sm text-suave"><Lock className="mt-0.5 size-3.5 shrink-0" /> {oc.notasInternas}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {oc.estado === "APROBADA" && <a href={`/api/oc/${oc.id}/pdf?aprobada=1`} target="_blank" rel="noopener" className={claseBoton("secundario", "chico")}><FileText /> PDF aprobado</a>}
        {completo && oc.numero && <a href={`/api/oc/${oc.id}/pdf`} target="_blank" rel="noopener" className={claseBoton("secundario", "chico")}><FileText /> {oc.estado === "APROBADA" ? "PDF original" : "Ver PDF"}</a>}
      </div>
      {completo && oc.adjuntos.length > 0 && <div className="mt-3"><ListaAdjuntos adjuntos={oc.adjuntos} /></div>}
    </section>
  );
}
