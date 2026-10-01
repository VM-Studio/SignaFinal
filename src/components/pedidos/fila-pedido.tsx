import Link from "next/link";
import type { ReactNode } from "react";
import { Insignia } from "@/components/ui/basicos";
import { textoEstado, textoParaCuando, TIPO } from "@/lib/pedidos/presentacion";
import type { PedidoPlano } from "@/lib/pedidos/consultas";
import { IconoTipo } from "./iconos";

export function EstadoPedido({ p }: { p: PedidoPlano }) {
  const e = textoEstado({ estado: p.estado, chofer: p.tomadoPor?.nombre, salidaEstimada: p.viaje?.salidaEstimada, llegadaReal: p.viaje?.llegadaReal });
  return <Insignia tono={e.tono}>{e.texto}</Insignia>;
}

/** Fila táctil del celular: tipo con ícono, qué, obra, para cuándo, quién pidió y estado. */
export function FilaPedido({ p, accion }: { p: PedidoPlano; accion?: ReactNode }) {
  const urgente = p.prioridad === "URGENTE" && p.estado === "PENDIENTE";
  return (
    <li className={`overflow-hidden rounded-[var(--radius-caja)] border bg-papel ${urgente ? "border-2 border-critico" : "border-linea"}`}>
      <div className="flex items-stretch">
        <Link href={`/pedidos/${p.id}`} className="flex min-w-0 flex-1 gap-3 p-4 hover:bg-fondo/60">
          <span className="grid size-10 shrink-0 place-items-center rounded-md bg-fondo">
            <IconoTipo tipo={p.tipo} className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-1.5 text-xs font-semibold tracking-wider text-suave uppercase">
              {TIPO[p.tipo].corto}
              {urgente && <Insignia tono="critico" className="normal-case tracking-normal">Urgente</Insignia>}
            </span>
            <span className="mt-0.5 line-clamp-2 block leading-snug font-bold">{p.descripcion}</span>
            <span className="mt-0.5 block text-[15px]">
              {p.origen.nombre} → Obra {p.obra.nombre}
            </span>
            <span className="mt-1 block text-sm text-suave">
              {textoParaCuando(p.paraCuando, p.franja)} · {p.solicitante.nombre}
            </span>
            <span className="mt-2 block">
              <EstadoPedido p={p} />
            </span>
          </span>
        </Link>
        {accion && <div className="flex shrink-0 items-center border-l border-linea p-3">{accion}</div>}
      </div>
    </li>
  );
}
