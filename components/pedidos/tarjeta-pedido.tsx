import Link from "next/link";
import { ArrowRight, Clock, Weight, User } from "lucide-react";
import { Estado } from "@/components/ui/estado";
import { ESTADO_PEDIDO, TIPO_CARGA, VEHICULO_REQUERIDO, textoEstadoPedido } from "@/lib/etiquetas";
import { cuando, diaRelativo, peso } from "@/lib/formato";
import type { PedidoPlano } from "@/lib/datos/pedidos";

export function EstadoPedido({ p }: { p: Pick<PedidoPlano, "estado" | "chofer"> }) {
  return <Estado tono={ESTADO_PEDIDO[p.estado].tono}>{textoEstadoPedido(p.estado, p.chofer?.nombre)}</Estado>;
}

/** Un pedido en la cola. Se entiende en tres segundos: a dónde, desde dónde, qué y en qué estado. */
export function TarjetaPedido({ p, posicion, accion }: { p: PedidoPlano; posicion?: number; accion?: React.ReactNode }) {
  return (
    <li className={`overflow-hidden rounded-[var(--radius-caja)] border bg-papel ${p.prioridad === "URGENTE" && p.estado === "PENDIENTE" ? "border-critico border-2" : "border-linea"}`}>
      <Link href={`/pedidos/${p.id}`} className="block p-4 hover:bg-fondo/50">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-suave">
              {posicion != null && <span className="grid size-5 place-items-center rounded bg-negro text-[11px] text-white">{posicion}</span>}
              Pedido {p.numero} · {TIPO_CARGA[p.tipoCarga]}
            </p>
            <h3 className="mt-1 text-lg leading-tight font-bold">Obra {p.obra.nombre}</h3>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <EstadoPedido p={p} />
            {p.prioridad === "URGENTE" && p.estado !== "ENTREGADO" && p.estado !== "CANCELADO" && <Estado tono="critico">Urgente</Estado>}
          </div>
        </div>

        <p className="mt-2 flex items-center gap-1.5 text-[15px] font-medium">
          <span className="truncate">{p.origen}</span>
          <ArrowRight className="size-4 shrink-0 text-suave" />
          <span className="truncate">{p.obra.nombre}</span>
        </p>
        <p className="mt-1 line-clamp-2 text-suave">{p.descripcion}</p>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-suave">
          {p.pesoKg && (
            <span className="flex items-center gap-1">
              <Weight className="size-4" /> {peso(p.pesoKg)}
              {p.vehiculoRequerido !== "CUALQUIERA" && ` · ${VEHICULO_REQUERIDO[p.vehiculoRequerido]}`}
            </span>
          )}
          <span className="flex items-center gap-1">
            <User className="size-4" /> {p.solicitante.nombre}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="size-4" /> {cuando(p.creadoEn)}
            {p.necesarioPara && ` · para ${diaRelativo(p.necesarioPara)}`}
          </span>
        </div>
      </Link>
      {accion && <div className="border-t border-linea p-3">{accion}</div>}
    </li>
  );
}
