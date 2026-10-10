import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquareText, Stamp } from "lucide-react";
import { exigirPermiso } from "@/lib/auth/sesion";
import { ocsParaAprobar } from "@/lib/compras/consultas";
import { paraAprobar } from "@/lib/materiales/consultas";
import { METODO_PAGO } from "@/lib/compras/estados";
import { nroOC, haceDias } from "@/lib/materiales/presentacion";
import { aFecha, cuando, fecha, plata } from "@/lib/formato";
import { Insignia, Tarjeta, Titulo, Vacio } from "@/components/ui/basicos";
import { ListaAdjuntos } from "@/components/adjuntos/lista";
import { BotonesAprobacion } from "@/components/materiales/acciones-material";
import { PdfPlegable } from "@/components/compras/pdf-plegable";

export const metadata: Metadata = { title: "Aprobaciones" };

const num = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 2 });

/**
 * El dueño aprueba las órdenes de compra viendo TODOS los datos escritos, sin abrir nada: número, obra,
 * solicitante, proveedor y sucursal, fecha necesaria, método de pago, la tabla de materiales, el total,
 * observaciones y adjuntos. Debajo, el PDF por si lo quiere ver igual. Aprobar (con deshacer) o rechazar.
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
            <li key={o.id}>
              <Tarjeta className="flex flex-col gap-4 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-2xl font-semibold tracking-tight tabular-nums">{o.numero}</p>
                    <p className="text-sm text-suave">Obra {o.obra} · pidió {o.solicitante} · armó {o.creadaPor} · enviada <span suppressHydrationWarning>{o.enviadaEn ? cuando(o.enviadaEn) : ""}</span></p>
                  </div>
                  <div className="flex items-center gap-2">
                    {o.prioridad === "URGENTE" && <Insignia tono="critico">Urgente</Insignia>}
                    <p className="text-right text-2xl font-semibold tabular-nums">{o.total != null ? `${o.moneda === "USD" ? "US" : ""}${plata(o.total)}` : <span className="text-base font-medium text-suave">Según presupuesto</span>}</p>
                  </div>
                </div>

                <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div><dt className="etiqueta">Proveedor</dt><dd className="mt-1 font-medium">{o.proveedor}</dd></div>
                  <div><dt className="etiqueta">Sucursal</dt><dd className="mt-1">{o.sucursal ? `${o.sucursal.nombre} · ${o.sucursal.direccion}` : "—"}</dd></div>
                  <div><dt className="etiqueta">Fecha necesaria</dt><dd className="mt-1">{o.fechaNecesaria ? fecha(aFecha(o.fechaNecesaria, "12:00")) : "—"}</dd></div>
                  <div><dt className="etiqueta">Método de pago</dt><dd className="mt-1 font-medium">{o.metodoPago ? METODO_PAGO[o.metodoPago] : "—"}{o.condiciones ? <span className="font-normal text-suave"> · {o.condiciones}</span> : null}</dd></div>
                </dl>

                <div className="overflow-x-auto rounded-md border border-linea">
                  <table className="tabla">
                    <thead><tr><th>Material</th><th className="num">Cantidad</th><th>Unidad</th><th className="num">Precio unit.</th><th className="num">Subtotal</th></tr></thead>
                    <tbody>
                      {o.renglones.map((r, i) => (
                        <tr key={i}><td>{r.descripcion}</td><td className="num">{num(r.cantidad)}</td><td className="text-suave">{r.unidad}</td><td className="num">{r.precioUnitario != null ? plata(r.precioUnitario) : "—"}</td><td className="num">{r.subtotal != null ? plata(r.subtotal) : "—"}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {o.total != null && (
                  <div className="ml-auto grid w-full max-w-xs grid-cols-2 gap-1 text-sm tabular-nums">
                    <span>Subtotal</span><span className="text-right">{plata(o.subtotal)}</span>
                    <span>{o.ivaPorcentaje != null ? `IVA ${num(o.ivaPorcentaje)} %` : "Sin IVA"}</span><span className="text-right">{plata(o.iva)}</span>
                    <span className="border-t border-linea pt-1 font-semibold">Total</span><span className="border-t border-linea pt-1 text-right font-semibold">{plata(o.total)}</span>
                  </div>
                )}

                {(o.observaciones || o.observacionesPedido) && (
                  <div className="grid gap-2 text-sm sm:grid-cols-2">
                    {o.observaciones && <p><span className="etiqueta block">Observaciones de la OC</span>{o.observaciones}</p>}
                    {o.observacionesPedido && <p className="flex gap-1.5"><MessageSquareText className="mt-0.5 size-3.5 shrink-0 text-suave" /><span><span className="etiqueta block">Lo que pidió la obra</span>{o.observacionesPedido}</span></p>}
                  </div>
                )}
                {o.adjuntos.length > 0 && <div><p className="etiqueta mb-2">Adjuntos (presupuesto)</p><ListaAdjuntos adjuntos={o.adjuntos} /></div>}

                <PdfPlegable ocId={o.id} numero={o.numero} />
                <div className="lg:max-w-md"><BotonesAprobacion id={o.pedidoMaterialId} oc={o.numero} /></div>
                <Link href={`/compras/${o.pedidoMaterialId}`} className="text-sm text-suave underline">Ver el pedido completo</Link>
              </Tarjeta>
            </li>
          ))}
          {sinOC.map((f) => (
            <li key={f.id}>
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
