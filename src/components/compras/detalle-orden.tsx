import type { ReactNode } from "react";
import { FileText, Lock } from "lucide-react";
import type { OCPlana } from "@/lib/compras/consultas";
import { CONDICION_PAGO, condicionPagoTexto, ESTADO_OC, FORMA_PAGO, importeTexto, TIPO_ORDEN } from "@/lib/compras/estados";
import { ESTADO_TABLERO, SEMAFORO_PE } from "@/lib/compras/estadoTablero";
import type { AdjuntoPlano } from "@/lib/archivos";
import { cuando } from "@/lib/formato";
import { claseBoton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/basicos";
import { ListaAdjuntos } from "@/components/adjuntos/lista";
import { AccionesOrden } from "./acciones-orden";

const f = (s: string | null) => (s ? s.split("-").reverse().join("/") : "");

/** Una fila de la ficha: etiqueta a la izquierda, valor a la derecha (como el bloque del Excel). */
export function FilaFicha({ etiqueta, children, ancho = false }: { etiqueta: string; children?: ReactNode; ancho?: boolean }) {
  return (
    <div className={`grid gap-1 border-b border-linea py-2 last:border-0 ${ancho ? "" : "sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-3"}`}>
      <dt className="text-[12px] font-medium text-suave sm:pt-0.5">{etiqueta}</dt>
      <dd className="min-w-0 whitespace-pre-line">{children || <span className="text-apagado">—</span>}</dd>
    </div>
  );
}

/**
 * La orden completa en el vocabulario de Alejandra: 1. Orden de Pedido, 1.1 Observaciones,
 * 2. Autorización, 3. Facturación y 4. Orden de Pago (estas dos solo si tienen datos), con las
 * acciones de cada rol. Se usa en el panel del tablero, en Órdenes y en el pedido de material.
 */
export function DetalleOrden({ oc, editable, autorizaPago, compacto = false }: { oc: OCPlana & { adjuntos: AdjuntoPlano[] }; editable: boolean; autorizaPago: boolean; compacto?: boolean }) {
  const t = TIPO_ORDEN[oc.tipo];
  const e = ESTADO_OC[oc.estado];
  const hayFacturacion = !!(oc.empresaFacturar || oc.facturaNumero || oc.facturaImporte != null || oc.facturaFecha || oc.facturaFormaPago || oc.facturaCondicion);
  const hayPago = !!(oc.ordenPagoAutorizadaEn || oc.fechaPago || oc.pagoImporte != null || oc.pagoObservaciones);
  const numero = oc.numero ? `${oc.numero}${oc.versionAprobacion > 1 ? ` v${oc.versionAprobacion}` : ""}` : "Borrador (sin número)";
  return (
    <article className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="etiqueta">{t.titulo}{oc.fuente === "IMPORTADA_EXCEL" ? " · importada del Excel" : ""}</p>
          <p className="mt-1 text-[22px] font-semibold tracking-tight tabular-nums">{numero}</p>
          {oc.empresaCompra && <p className="text-sm text-suave">{oc.empresaCompra.nombre} · {oc.empresaCompra.cuit}</p>}
        </div>
        <div className="flex flex-wrap gap-1">
          {oc.estadoTablero && <Insignia tono={ESTADO_TABLERO[oc.estadoTablero].tono}>{ESTADO_TABLERO[oc.estadoTablero].titulo}</Insignia>}
          {oc.fuente === "SISTEMA" && <Insignia tono={e.tono}>{e.titulo}</Insignia>}
          {oc.tipo === "PE" && oc.semaforoPE && <Insignia tono={SEMAFORO_PE[oc.semaforoPE].tono}>{SEMAFORO_PE[oc.semaforoPE].titulo}</Insignia>}
        </div>
      </header>

      <AccionesOrden oc={oc} editable={editable} autorizaPago={autorizaPago} />

      <section>
        <h3 className="mb-1 text-[15px] font-semibold">1. Orden de Pedido</h3>
        <dl className="rounded-[var(--radius-caja)] border border-linea bg-papel px-3 text-sm">
          <FilaFicha etiqueta="Fecha del pedido">{f(oc.fecha)}</FilaFicha>
          <FilaFicha etiqueta="Fecha de caducidad">{f(oc.fechaNecesaria)}</FilaFicha>
          <FilaFicha etiqueta="Solicitado por">{oc.solicitadoPor}</FilaFicha>
          <FilaFicha etiqueta="Obra">{oc.obra}</FilaFicha>
          <FilaFicha etiqueta="Detalle del Pedido">
            {oc.detallePedido}
            {oc.renglones.length > 0 && (
              <ul className="mt-1 list-disc pl-5 text-suave">
                {oc.renglones.map((r, i) => <li key={i}>{r.cantidad.toLocaleString("es-AR")} {r.unidad} {r.descripcion}{r.precioUnitario != null ? ` · ${importeTexto(r.precioUnitario, oc.moneda)}` : ""}</li>)}
              </ul>
            )}
          </FilaFicha>
          <FilaFicha etiqueta="Proveedor Sugerido">{oc.proveedorSugerido}</FilaFicha>
          <FilaFicha etiqueta="Proveedor Final">{oc.proveedor ? `${oc.proveedor}${oc.sucursal ? `\n${oc.sucursal.nombre} · ${oc.sucursal.direccion}` : ""}` : null}</FilaFicha>
          <FilaFicha etiqueta="Presupuesto N°">{oc.presupuestoNumero}</FilaFicha>
          <FilaFicha etiqueta="Importe">
            {oc.importe != null || oc.importeAConfirmar ? <span className="font-medium tabular-nums">{importeTexto(oc.importe, oc.moneda, oc.importeAConfirmar)}</span> : null}
            {oc.moneda === "USD" && oc.cotizacionUsd ? <span className="block text-[12px] text-suave">Dólar del día: $ {oc.cotizacionUsd.toLocaleString("es-AR")}</span> : null}
          </FilaFicha>
          <FilaFicha etiqueta="Forma de Pago">{oc.formaPago ? FORMA_PAGO[oc.formaPago] : null}</FilaFicha>
          <FilaFicha etiqueta="Condición de Pago">{condicionPagoTexto(oc.condicionPago, oc.condicionPagoTexto)}</FilaFicha>
          <FilaFicha etiqueta="Fecha de entrega">{f(oc.fechaEntrega)}</FilaFicha>
        </dl>
      </section>

      <section>
        <h3 className="mb-1 text-[15px] font-semibold">1.1 Observaciones de la Orden de Pedido</h3>
        <p className="rounded-[var(--radius-caja)] border border-linea bg-papel px-3 py-2 text-sm whitespace-pre-line">{oc.observaciones || <span className="text-apagado">—</span>}</p>
        {editable && oc.notasInternas && <p className="mt-2 flex items-start gap-1.5 text-sm text-suave"><Lock className="mt-0.5 size-3.5 shrink-0" /> {oc.notasInternas}</p>}
      </section>

      {oc.fuente === "SISTEMA" && (
        <section>
          <h3 className="mb-1 text-[15px] font-semibold">2. Autorización a la Orden de Pedido</h3>
          <div className={`rounded-[var(--radius-caja)] border px-3 py-2 text-sm ${oc.estado === "APROBADA" ? "border-ok bg-ok-fondo text-ok" : oc.motivoRechazo ? "border-critico bg-critico-fondo text-critico" : "border-linea bg-papel"}`}>
            <p className="font-medium">{oc.estado === "APROBADA" ? "Autorizada" : oc.estado === "ESPERANDO_APROBACION" ? "Esperando la autorización del dueño" : e.titulo}</p>
            {oc.aprobadaEn && <p>Autorizó {oc.aprobadaPor} · <span suppressHydrationWarning>{cuando(oc.aprobadaEn)}</span></p>}
            {oc.motivoRechazo && <p>Motivo: {oc.motivoRechazo}</p>}
            {oc.motivoAnulacion && <p>Anulada: {oc.motivoAnulacion}</p>}
          </div>
        </section>
      )}

      {(hayFacturacion || !compacto) && (
        <section>
          <h3 className="mb-1 text-[15px] font-semibold">3. Facturación</h3>
          {hayFacturacion ? (
            <dl className="rounded-[var(--radius-caja)] border border-linea bg-papel px-3 text-sm">
              <FilaFicha etiqueta="Empresa para facturar">{oc.empresaFacturar ? `${oc.empresaFacturar.nombre} · ${oc.empresaFacturar.cuit}` : null}</FilaFicha>
              <FilaFicha etiqueta="Factura N°">{oc.facturaNumero}</FilaFicha>
              <FilaFicha etiqueta="Importe">{oc.facturaImporte != null ? importeTexto(oc.facturaImporte, oc.moneda) : null}</FilaFicha>
              <FilaFicha etiqueta="Fecha">{f(oc.facturaFecha)}</FilaFicha>
              <FilaFicha etiqueta="Forma de Pago">{oc.facturaFormaPago ? FORMA_PAGO[oc.facturaFormaPago] : null}</FilaFicha>
              <FilaFicha etiqueta="Condición de Pago">{oc.facturaCondicion ? CONDICION_PAGO[oc.facturaCondicion] : null}</FilaFicha>
            </dl>
          ) : <p className="text-sm text-suave">Sin datos de facturación todavía.</p>}
        </section>
      )}

      {(hayPago || !compacto) && (
        <section>
          <h3 className="mb-1 text-[15px] font-semibold">4. Orden de Pago</h3>
          {hayPago ? (
            <dl className="rounded-[var(--radius-caja)] border border-linea bg-papel px-3 text-sm">
              <FilaFicha etiqueta="Autorización a la Orden de Pago">{oc.ordenPagoAutorizadaEn ? <>{oc.ordenPagoAutorizadaPor} · <span suppressHydrationWarning>{cuando(oc.ordenPagoAutorizadaEn)}</span></> : null}</FilaFicha>
              <FilaFicha etiqueta="Fecha de Pago">{f(oc.fechaPago)}</FilaFicha>
              <FilaFicha etiqueta="Importe pagado">{oc.pagoImporte != null ? importeTexto(oc.pagoImporte, oc.moneda) : null}</FilaFicha>
              <FilaFicha etiqueta="Observaciones">{oc.pagoObservaciones}</FilaFicha>
            </dl>
          ) : <p className="text-sm text-suave">Sin orden de pago todavía.</p>}
        </section>
      )}

      {(oc.proximosPasos || oc.comentarios) && (
        <section className="grid gap-3 sm:grid-cols-2">
          <div><p className="etiqueta">Próximos pasos</p><p className="mt-1 text-sm whitespace-pre-line">{oc.proximosPasos || "—"}</p></div>
          <div><p className="etiqueta">Comentarios</p><p className="mt-1 text-sm whitespace-pre-line">{oc.comentarios || "—"}</p></div>
        </section>
      )}

      {oc.numero && oc.fuente === "SISTEMA" && (
        <div className="flex flex-wrap gap-2">
          {oc.estado === "APROBADA" && <a href={`/api/oc/${oc.id}/pdf?aprobada=1`} target="_blank" rel="noopener" className={claseBoton("secundario", "chico")}><FileText /> PDF autorizado</a>}
          <a href={`/api/oc/${oc.id}/pdf`} target="_blank" rel="noopener" className={claseBoton("secundario", "chico")}><FileText /> {oc.estado === "APROBADA" ? "PDF original" : "Ver PDF"}</a>
        </div>
      )}
      {oc.adjuntos.length > 0 && <div><p className="etiqueta mb-1">Adjuntos</p><ListaAdjuntos adjuntos={oc.adjuntos} /></div>}
    </article>
  );
}
