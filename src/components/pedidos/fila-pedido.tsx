import Link from "next/link";
import type { ReactNode } from "react";
import { Insignia } from "@/components/ui/basicos";
import { textoEstado, textoParaCuando } from "@/lib/pedidos/presentacion";
import type { PedidoPlano } from "@/lib/pedidos/consultas";
import { IconoTipo } from "./iconos";

export function EstadoPedido({ p }: { p: PedidoPlano }) {
  const e = textoEstado({ estado: p.estado, chofer: p.tomadoPor?.nombre, salidaEstimada: p.viaje?.salidaEstimada, llegadaReal: p.viaje?.llegadaReal });
  return <Insignia tono={e.tono}>{e.texto}</Insignia>;
}

/** Fila del celular (sin tarjeta, borde inferior): tipo, qué, de dónde a qué obra, para cuándo, quién pidió y estado. */
export function FilaPedido({ p, accion }: { p: PedidoPlano; accion?: ReactNode }) {
  const urgente = p.prioridad === "URGENTE" && p.estado === "PENDIENTE";
  return (
    <li className="flex items-stretch">
      <Link href={`/solicitudes/${p.id}`} className="flex min-w-0 flex-1 gap-3 px-4 py-3 active:bg-hover">
        <IconoTipo tipo={p.tipo} className="mt-0.5 size-5 shrink-0 text-suave" />
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 block leading-snug font-medium">{p.descripcion}</span>
          <span className="mt-0.5 block truncate text-sm text-suave">
            {p.origen.nombre} → Obra {p.obra.nombre}
          </span>
          <span className="block truncate text-sm text-suave">
            {textoParaCuando(p.paraCuando, p.franja)} · {p.solicitante.nombre}
          </span>
          <span className="mt-1.5 flex flex-wrap gap-1.5">
            <EstadoPedido p={p} />
            {urgente && <Insignia tono="critico">Urgente</Insignia>}
          </span>
        </span>
      </Link>
      {accion && <div className="flex shrink-0 items-center pr-4">{accion}</div>}
    </li>
  );
}

/** Contenedor de filas del celular: de borde a borde, separadas por una línea. */
export function FilasPedido({ children }: { children: ReactNode }) {
  return <ul className="-mx-4 divide-y divide-linea border-y border-linea bg-papel lg:hidden">{children}</ul>;
}
