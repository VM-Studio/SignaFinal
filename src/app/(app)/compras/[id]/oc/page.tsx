import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, MessageSquareText } from "lucide-react";
import { formularioOC } from "@/lib/compras/consultas";
import { Insignia, Tarjeta } from "@/components/ui/basicos";
import { ListaAdjuntos } from "@/components/adjuntos/lista";
import { FormularioOC } from "@/components/compras/formulario-oc";
import { VisorAdjunto } from "@/components/adjuntos/visor";
import { paraElDia, aFecha } from "@/lib/formato";

export const metadata: Metadata = { title: "Orden de compra" };

/**
 * Armar la orden de compra de un pedido. Escritorio: el pedido a la izquierda (para copiar datos, con el
 * adjunto a la vista) y el formulario a la derecha. Celular: el formulario, con el pedido arriba plegado.
 */
export default async function PaginaOC({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await formularioOC(id); // verifica materiales.gestionar
  if (!d) notFound();
  if (d.pedido.estado !== "EN_COMPRA") redirect(`/compras/${id}`);
  const visible = d.adjuntosPedido.find((a) => a.tipoMime === "application/pdf" || a.tipoMime.startsWith("image/"));

  const pedido = (
    <div className="flex flex-col gap-3">
      <div>
        <p className="etiqueta">Pedido de material {d.pedido.numero}</p>
        <p className="mt-1 font-medium whitespace-pre-line">{d.pedido.descripcion}</p>
        <p className="text-sm text-suave">Obra {d.pedido.obra}{d.pedido.sede ? ` · ${d.pedido.sede}` : ""} · pidió {d.pedido.solicitante} · {paraElDia(aFecha(d.pedido.paraCuando, "12:00"))}</p>
        <p className="text-sm text-suave">Entrega: {d.pedido.direccionEntrega}</p>
      </div>
      {d.pedido.observaciones && (
        <Tarjeta className="bg-hover p-3">
          <p className="etiqueta flex items-center gap-1.5"><MessageSquareText className="size-3.5" /> Observaciones del solicitante</p>
          <p className="mt-1 text-sm whitespace-pre-line">{d.pedido.observaciones}</p>
        </Tarjeta>
      )}
      {d.pedido.renglones.length > 0 && (
        <ul className="divide-y divide-linea rounded-[var(--radius-caja)] border border-linea bg-papel text-sm">
          {d.pedido.renglones.map((r, i) => <li key={i} className="flex justify-between gap-3 px-3 py-2"><span>{r.descripcion}</span><span className="shrink-0 text-suave tabular-nums">{r.cantidad ?? "—"} {r.unidad ?? ""}</span></li>)}
        </ul>
      )}
      {d.adjuntosPedido.length > 0 && <ListaAdjuntos adjuntos={d.adjuntosPedido} />}
      {visible && <div className="hidden lg:block"><VisorAdjunto id={visible.id} nombre={visible.nombre} tipo={visible.tipoMime} /></div>}
      {d.anteriores.map((o) => (
        <Tarjeta key={o.id} className="p-3 text-sm">
          <div className="flex items-center justify-between gap-2"><span className="font-medium">{o.numero ?? "Borrador"}</span><Insignia tono={o.estado === "RECHAZADA" ? "critico" : "neutro"}>{o.estado === "RECHAZADA" ? "Rechazada" : "Anulada"}</Insignia></div>
          {(o.motivoRechazo || o.motivoAnulacion) && <p className="mt-1 text-suave">Motivo: {o.motivoRechazo ?? o.motivoAnulacion}</p>}
        </Tarjeta>
      ))}
    </div>
  );

  return (
    <div className="lg:-my-6 lg:-ml-6 lg:grid lg:grid-cols-[minmax(320px,36%)_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-12 lg:h-[calc(100dvh-48px)] lg:overflow-y-auto lg:border-r lg:border-linea lg:bg-papel lg:p-6">
        <Link href={`/compras/${id}`} className="mb-3 inline-flex min-h-9 items-center gap-1 text-sm font-medium text-suave hover:text-tinta"><ArrowLeft className="size-4" /> Volver al pedido</Link>
        <details className="mb-4 rounded-[var(--radius-caja)] border border-linea bg-papel p-3 lg:hidden">
          <summary className="cursor-pointer text-sm font-medium">Ver el pedido (para copiar datos)</summary>
          <div className="mt-3">{pedido}</div>
        </details>
        <div className="hidden lg:block">{pedido}</div>
      </aside>
      <div className="min-w-0 lg:py-6 lg:pl-6">
        <h1 className="mb-4 text-xl font-semibold lg:sr-only">Orden de compra</h1>
        <FormularioOC d={d} />
      </div>
    </div>
  );
}
