import type { Metadata } from "next";
import Link from "next/link";
import { Banknote, MessageSquareText, Stamp } from "lucide-react";
import { exigirPermiso } from "@/lib/auth/sesion";
import { pagosParaAutorizar, paraAutorizar } from "@/lib/compras/documento-consultas";
import { cuando } from "@/lib/formato";
import { Insignia, PaginaCompleta, Segmentos, Tarjeta, Titulo, Vacio } from "@/components/ui/basicos";
import { ListaAdjuntos } from "@/components/adjuntos/lista";
import { BotonesAprobacion, BotonAutorizarPago, PdfPlegable } from "@/components/compras/documento/aprobacion";

export const metadata: Metadata = { title: "Aprobaciones" };

/**
 * El dueño autoriza: ÓRDENES (OC y PE) viendo TODOS los datos escritos con las palabras de la plantilla y el
 * PDF embebido, con Aprobar (y deshacer) o Rechazar con el motivo; y PAGOS que pidió Administración.
 */
export default async function PaginaAprobaciones({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  await exigirPermiso("materiales.aprobar");
  const { p } = await searchParams;
  const pestana = p === "pagos" ? "pagos" : "ordenes";
  const [ocs, pagos] = await Promise.all([paraAutorizar(), pagosParaAutorizar()]);
  const fila = (etiqueta: string, valor: string) => (
    <div><dt className="etiqueta">{etiqueta}</dt><dd className="mt-1 font-medium">{valor || <span className="font-normal text-suave">—</span>}</dd></div>
  );
  return (
    <PaginaCompleta>
      <Titulo siempre>Aprobaciones</Titulo>
      <Segmentos items={[
        { href: "/aprobaciones", etiqueta: "Órdenes", cantidad: ocs.length, activa: pestana === "ordenes" },
        { href: "/aprobaciones?p=pagos", etiqueta: "Pagos", cantidad: pagos.length, activa: pestana === "pagos" },
      ]} />
      {pestana === "ordenes" ? (
        ocs.length === 0 ? (
          <Vacio llenar icono={<Stamp />} titulo="No hay órdenes para autorizar" />
        ) : (
          <ul className="flex flex-col gap-4">
            {ocs.map((o) => {
              const t = o.textos;
              return (
                <li key={o.id} data-vivo-id={o.id}>
                  <Tarjeta className="flex flex-col gap-4 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="etiqueta">{o.tipo === "PE" ? "Pedido especial" : "Orden de compra"}{t.empresa ? ` · ${t.empresa}` : ""}</p>
                        <p className="text-2xl font-semibold tracking-tight tabular-nums">{o.nombre}</p>
                        <p className="text-sm text-suave">Obra {t.obra} · solicitado por {t.solicitadoPor || "—"} · Compras: {o.comprador ?? "—"} · enviada <span suppressHydrationWarning>{o.enviadaEn ? cuando(new Date(o.enviadaEn)) : ""}</span></p>
                      </div>
                      <div className="flex items-center gap-2">
                        {o.prioridad === "URGENTE" && <Insignia tono="critico">Urgente</Insignia>}
                        <p className="text-right text-2xl font-semibold tabular-nums">{t.importe || <span className="text-base font-medium text-suave">Sin importe</span>}</p>
                      </div>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                      <div className="min-w-0">
                        <p className="etiqueta mb-1">Detalle del Pedido</p>
                        <p className="text-[15px] whitespace-pre-line">{t.detalleDelPedido}</p>
                      </div>
                      <dl className="grid content-start gap-3 text-sm sm:grid-cols-2">
                        {fila("Proveedor Final", t.proveedorFinal)}
                        {fila("Proveedor Sugerido", t.proveedorSugerido)}
                        {fila("Presupuesto N°", t.presupuestoN)}
                        {fila("Forma de Pago", t.formaDePago)}
                        {fila("Fecha de caducidad", t.fechaCaducidad)}
                        {fila("Fecha del pedido", t.fechaPedido)}
                      </dl>
                    </div>
                    {(t.observacionesOrdenPedido || o.observacionesSolicitante) && (
                      <div className="grid gap-2 text-sm sm:grid-cols-2">
                        {t.observacionesOrdenPedido && <p><span className="etiqueta block">1.1 Observaciones de la Orden de Pedido</span><span className="whitespace-pre-line">{t.observacionesOrdenPedido}</span></p>}
                        {o.observacionesSolicitante && <p className="flex gap-1.5"><MessageSquareText className="mt-0.5 size-3.5 shrink-0 text-suave" /><span><span className="etiqueta block">Lo que pidió la obra</span>{o.observacionesSolicitante}</span></p>}
                      </div>
                    )}
                    {o.adjuntos.length > 0 && <div><p className="etiqueta mb-2">Adjuntos</p><ListaAdjuntos adjuntos={o.adjuntos} /></div>}
                    <PdfPlegable ocId={o.id} numero={o.nombre} abierto />
                    <div className="lg:max-w-md"><BotonesAprobacion id={o.id} nombre={o.nombre} /></div>
                    <Link href={`/compras/oc/${o.id}?desde=aprobaciones`} className="text-sm text-suave underline">Abrir la orden</Link>
                  </Tarjeta>
                </li>
              );
            })}
          </ul>
        )
      ) : pagos.length === 0 ? (
        <Vacio llenar icono={<Banknote />} titulo="No hay pagos para autorizar" />
      ) : (
        <ul className="divide-y divide-linea rounded-[var(--radius-caja)] border border-linea bg-papel">
          {pagos.map((x) => (
            <li key={x.id} data-vivo-id={x.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <Link href={`/compras/oc/${x.id}?desde=aprobaciones`} className="font-semibold tabular-nums hover:underline">{x.nombre}</Link>
                <p className="text-sm text-suave">{[x.textos.proveedorFinal, x.textos.obra && `Obra ${x.textos.obra}`, x.textos.facturaN && `Factura ${x.textos.facturaN}`, x.textos.condicionDePago].filter(Boolean).join(" · ")}</p>
                <p className="text-[12px] text-suave">Lo pidió {x.pedidoPor} <span suppressHydrationWarning>{cuando(new Date(x.pedidoEn))}</span>{x.facturaAdjuntoId ? <> · <a href={`/api/adjuntos/${x.facturaAdjuntoId}`} target="_blank" rel="noopener" className="underline">ver la factura</a></> : null}</p>
              </div>
              <p className="text-xl font-semibold tabular-nums">{x.textos.facturaImporte || x.textos.importe}</p>
              <BotonAutorizarPago id={x.id} />
            </li>
          ))}
        </ul>
      )}
    </PaginaCompleta>
  );
}
