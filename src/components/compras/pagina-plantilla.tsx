import Link from "next/link";
import { ArrowLeft, MessageSquareText } from "lucide-react";
import type { FormularioOCDatos } from "@/lib/compras/consultas";
import { TIPO_ORDEN } from "@/lib/compras/estados";
import { aFecha, paraElDia } from "@/lib/formato";
import { Tarjeta } from "@/components/ui/basicos";
import { ListaAdjuntos } from "@/components/adjuntos/lista";
import { VisorAdjunto } from "@/components/adjuntos/visor";
import { CotizacionDolar } from "./cotizacion-dolar";
import { FormularioOC } from "./formulario-oc";

/**
 * La plantilla con su contexto. Escritorio: la ficha en 2/3 y, a la derecha (1/3), el pedido de
 * material para copiar datos (con el adjunto a la vista) o, si se arma desde Órdenes, la ayuda y el
 * dólar. Celular: la ficha, con el pedido arriba plegado.
 */
export function PaginaPlantilla({ d, volver }: { d: FormularioOCDatos; volver: { href: string; texto: string } }) {
  const p = d.pedido;
  const visible = d.adjuntosPedido.find((a) => a.tipoMime === "application/pdf" || a.tipoMime.startsWith("image/"));
  const tipo = TIPO_ORDEN[d.orden?.tipo ?? d.tipoInicial];
  const contexto = p ? (
    <div className="flex flex-col gap-3">
      <div>
        <p className="etiqueta">Pedido de material {p.numero}</p>
        <p className="mt-1 font-medium whitespace-pre-line">{p.descripcion}</p>
        <p className="text-sm text-suave">Obra {p.obra}{p.sede ? ` · ${p.sede}` : ""} · pidió {p.solicitante} · {paraElDia(aFecha(p.paraCuando, "12:00"))}{p.prioridad === "URGENTE" ? " · urgente" : ""}</p>
        <p className="text-sm text-suave">Entrega: {p.direccionEntrega}</p>
      </div>
      {p.observaciones && (
        <Tarjeta className="bg-hover p-3">
          <p className="etiqueta flex items-center gap-1.5"><MessageSquareText className="size-3.5" /> Observaciones del solicitante</p>
          <p className="mt-1 text-sm whitespace-pre-line">{p.observaciones}</p>
        </Tarjeta>
      )}
      {p.renglones.length > 0 && (
        <ul className="divide-y divide-linea rounded-[var(--radius-caja)] border border-linea bg-papel text-sm">
          {p.renglones.map((r, i) => <li key={i} className="flex justify-between gap-3 px-3 py-2"><span>{r.descripcion}</span><span className="shrink-0 text-suave tabular-nums">{r.cantidad ?? "—"} {r.unidad ?? ""}</span></li>)}
        </ul>
      )}
      {d.adjuntosPedido.length > 0 && <ListaAdjuntos adjuntos={d.adjuntosPedido} />}
      {visible && <div className="hidden lg:block"><VisorAdjunto id={visible.id} nombre={visible.nombre} tipo={visible.tipoMime} /></div>}
    </div>
  ) : (
    <div className="flex flex-col gap-3 text-sm">
      <p className="etiqueta">Cómo funciona</p>
      <p className="text-suave">Completá la ficha como en tu planilla. Con <b className="font-medium text-tinta">Guardar</b> queda en Órdenes como borrador (sin número).</p>
      <p className="text-suave"><b className="font-medium text-tinta">Enviar a aprobación</b> le asigna el número ({tipo.corto}-NNNN), arma el PDF y le avisa al dueño. Cuando la autoriza, aparece en el tablero como Autorizada.</p>
      <p className="text-suave">Al elegir la obra y quién lo pidió se crea el pedido de material por detrás: lo ve el que lo pidió y sigue el circuito (habilitar, retiro, entrega).</p>
      <CotizacionDolar variante="tarjeta" />
    </div>
  );
  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
      <div className="min-w-0">
        <Link href={volver.href} className="mb-3 inline-flex min-h-9 items-center gap-1 text-sm font-medium text-suave hover:text-tinta"><ArrowLeft className="size-4" /> {volver.texto}</Link>
        {p && (
          <details className="mb-4 rounded-[var(--radius-caja)] border border-linea bg-papel p-3 lg:hidden">
            <summary className="cursor-pointer text-sm font-medium">Ver el pedido (para copiar datos)</summary>
            <div className="mt-3">{contexto}</div>
          </details>
        )}
        <h1 className="mb-4 text-xl font-semibold lg:sr-only">{tipo.titulo}</h1>
        <FormularioOC d={d} />
      </div>
      <aside className="hidden min-w-0 lg:block">
        <div className="sticky top-[72px] max-h-[calc(100dvh-96px)] overflow-y-auto rounded-[var(--radius-caja)] border border-linea bg-papel p-4">{contexto}</div>
      </aside>
    </div>
  );
}
