import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquareText, Stamp } from "lucide-react";
import { exigirPermiso } from "@/lib/auth/sesion";
import { ocsParaAprobar } from "@/lib/compras/consultas";
import { paraAprobar } from "@/lib/materiales/consultas";
import { condicionPagoTexto, FORMA_PAGO, importeTexto, TIPO_ORDEN } from "@/lib/compras/estados";
import { nroOC, haceDias } from "@/lib/materiales/presentacion";
import { aFecha, cuando, fecha, plata } from "@/lib/formato";
import { Insignia, Tarjeta, Titulo, Vacio } from "@/components/ui/basicos";
import { ListaAdjuntos } from "@/components/adjuntos/lista";
import { BotonesAprobacion } from "@/components/materiales/acciones-material";
import { PdfPlegable } from "@/components/compras/pdf-plegable";

export const metadata: Metadata = { title: "Aprobaciones" };

const num = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 2 });

/**
 * El dueño aprueba las órdenes (OC y PE) viendo TODOS los datos escritos, sin abrir nada, con el
 * vocabulario de la plantilla de Compras: número (y v2 si vuelve por un cambio de fondo), obra,
 * solicitado por, detalle del pedido, proveedor final, importe, forma y condición de pago, observaciones
 * y adjuntos. Debajo, el PDF por si lo quiere ver igual. Aprobar (con deshacer) o rechazar.
 */
export default async function PaginaAprobaciones() {
  await exigirPermiso("materiales.aprobar");
  const [ocs, viejas] = await Promise.all([ocsParaAprobar(), paraAprobar()]);
  // Pedidos esperando sin OC del sistema (cargados con el número de Lebane a mano, antes de este cambio).
  const sinOC = viejas.filter((v) => !ocs.some((o) => o.pedidoMaterialId === v.id));
  const total = ocs.length + sinOC.length;
  return (
    <div>
      <Titulo siempre detalle={total ? `${total} ${total === 1 ? "orden de compra espera" : "órdenes de compra esperan"} tu aprobación.` : "Órdenes de compra que armó Compras."}>Aprobaciones</Titulo>
      {total === 0 ? (
        <Vacio icono={<Stamp />} titulo="No hay nada para aprobar">Cuando Compras arme una orden de compra, aparece acá y te llega el aviso.</Vacio>
      ) : (
        <ul className="flex flex-col gap-4">
          {ocs.map((o) => (
            <li key={o.id} data-vivo-id={o.pedidoMaterialId}>
              <Tarjeta className="flex flex-col gap-4 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="etiqueta">{TIPO_ORDEN[o.tipo].titulo}{o.empresaCompra ? ` · ${o.empresaCompra.nombre}` : ""}</p>
                    <p className="text-2xl font-semibold tracking-tight tabular-nums">{o.numero}{o.versionAprobacion > 1 ? <span className="text-suave"> v{o.versionAprobacion}</span> : null}</p>
                    <p className="text-sm text-suave">Obra {o.obra} · pidió {o.solicitadoPor} · armó {o.creadaPor} · enviada <span suppressHydrationWarning>{o.enviadaEn ? cuando(o.enviadaEn) : ""}</span></p>
                  </div>
                  <div className="flex items-center gap-2">
                    {o.prioridad === "URGENTE" && <Insignia tono="critico">Urgente</Insignia>}
                    <p className="text-right text-2xl font-semibold tabular-nums">{o.importe != null || o.importeAConfirmar ? importeTexto(o.importe, o.moneda, o.importeAConfirmar) : <span className="text-base font-medium text-suave">Sin importe</span>}</p>
                  </div>
                </div>
                {o.versionAprobacion > 1 && <p className="rounded-md bg-aviso-fondo px-3 py-2 text-sm text-aviso-texto">Ya la habías autorizado: Compras cambió algo de fondo y vuelve como v{o.versionAprobacion}.</p>}

                <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                  <div className="min-w-0">
                    <p className="etiqueta mb-1">Detalle del Pedido</p>
                    {o.detallePedido && <p className="text-[15px] whitespace-pre-line">{o.detallePedido}</p>}
                    {o.renglones.length > 0 && (
                      <div className="mt-2 overflow-x-auto rounded-md border border-linea">
                        <table className="tabla">
                          <thead><tr><th className="num">Cantidad</th><th>Unidad</th><th>Material</th><th className="num">Precio unit.</th></tr></thead>
                          <tbody>{o.renglones.map((r, i) => <tr key={i}><td className="num">{num(r.cantidad)}</td><td className="text-suave">{r.unidad}</td><td>{r.descripcion}</td><td className="num">{r.precioUnitario != null ? importeTexto(r.precioUnitario, o.moneda) : "—"}</td></tr>)}</tbody>
                        </table>
                      </div>
                    )}
                  </div>
                  <dl className="grid content-start gap-3 text-sm sm:grid-cols-2">
                    <div><dt className="etiqueta">Proveedor Final</dt><dd className="mt-1 font-medium">{o.proveedor ?? <span className="font-normal text-suave">A definir{o.proveedorSugerido ? ` (sugerido: ${o.proveedorSugerido})` : ""}</span>}</dd>{o.sucursal && <dd className="text-suave">{o.sucursal.nombre} · {o.sucursal.direccion}</dd>}</div>
                    <div><dt className="etiqueta">Presupuesto N°</dt><dd className="mt-1">{o.presupuestoNumero ?? "—"}</dd></div>
                    <div><dt className="etiqueta">Forma de Pago</dt><dd className="mt-1 font-medium">{o.formaPago ? FORMA_PAGO[o.formaPago] : "—"}</dd></div>
                    <div><dt className="etiqueta">Condición de Pago</dt><dd className="mt-1">{condicionPagoTexto(o.condicionPago, o.condicionPagoTexto) ?? "—"}</dd></div>
                    <div><dt className="etiqueta">Fecha de caducidad</dt><dd className="mt-1">{o.fechaNecesaria ? fecha(aFecha(o.fechaNecesaria, "12:00")) : "—"}</dd></div>
                    <div><dt className="etiqueta">Fecha de entrega</dt><dd className="mt-1">{o.fechaEntrega ? fecha(aFecha(o.fechaEntrega, "12:00")) : "—"}</dd></div>
                  </dl>
                </div>

                {(o.observaciones || o.observacionesPedido) && (
                  <div className="grid gap-2 text-sm sm:grid-cols-2">
                    {o.observaciones && <p><span className="etiqueta block">1.1 Observaciones de la Orden de Pedido</span><span className="whitespace-pre-line">{o.observaciones}</span></p>}
                    {o.observacionesPedido && <p className="flex gap-1.5"><MessageSquareText className="mt-0.5 size-3.5 shrink-0 text-suave" /><span><span className="etiqueta block">Lo que pidió la obra</span>{o.observacionesPedido}</span></p>}
                  </div>
                )}
                {o.adjuntos.length > 0 && <div><p className="etiqueta mb-2">Adjuntos (presupuesto)</p><ListaAdjuntos adjuntos={o.adjuntos} /></div>}

                <PdfPlegable ocId={o.id} numero={o.numero ?? ""} />
                <div className="lg:max-w-md"><BotonesAprobacion id={o.pedidoMaterialId!} oc={o.numero} /></div>
                <Link href={`/compras/tablero?ver=${o.id}`} className="text-sm text-suave underline">Ver la orden en el tablero</Link>
              </Tarjeta>
            </li>
          ))}
          {sinOC.map((f) => (
            <li key={f.id} data-vivo-id={f.id}>
              <Tarjeta className="p-4">
                <p className="etiqueta">{nroOC(f.ordenCompra) ?? "Sin número de OC"} · Obra {f.obra}</p>
                <Link href={`/compras/${f.id}`} className="mt-1 block font-medium whitespace-pre-line hover:underline">{f.descripcion}</Link>
                <p className="mt-2 text-2xl font-semibold tabular-nums">{f.monto != null ? plata(f.monto) : "Sin monto"}</p>
                <p className="mt-1 text-sm text-suave">Pidió {f.solicitante} · Compras: {f.comprador ?? "—"} · enviada {haceDias(new Date(f.enEstadoDesde))} · cargada a mano (sin OC del sistema)</p>
                <div className="mt-3 lg:max-w-md"><BotonesAprobacion id={f.id} oc={f.ordenCompra} /></div>
              </Tarjeta>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
