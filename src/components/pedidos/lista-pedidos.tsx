import { FilaLista, Insignia, Lista } from "@/components/ui/basicos";
import { ESTADO_PEDIDO, textoEstadoPedido } from "@/lib/etiquetas";
import { cuando, hora } from "@/lib/formato";
import type { FilaPedidoLista } from "@/lib/pedidos/listas";

/** "llega 10:40 aprox" si está en viaje y hay hora estimada; si no, para cuándo es. */
function cuandoLlega(p: FilaPedidoLista) {
  if (p.estado === "EN_VIAJE" && p.viaje?.etaDestino) return `llega ${hora(p.viaje.etaDestino)} aprox`;
  if (p.estado === "ENTREGADO" && p.viaje?.llegadaReal) return `entregado ${hora(p.viaje.llegadaReal)}`;
  return `para ${cuando(p.paraCuando)}`;
}

/** Lista de pedidos con el estado en palabras. base: a qué detalle lleva cada fila. */
export function ListaPedidos({ filas, base, conSolicitante = false }: { filas: FilaPedidoLista[]; base: string | null; conSolicitante?: boolean }) {
  return (
    <Lista>
      {filas.map((p) => (
        <FilaLista
          key={p.id}
          href={base ? `${base}/${p.id}` : undefined}
          titulo={p.descripcion}
          detalle={
            <>
              <span className="block truncate">{[p.destinoNombre, cuandoLlega(p), conSolicitante ? `pidió ${p.solicitante.nombre}` : null].filter(Boolean).join(" · ")}</span>
              <span className="mt-1.5 flex flex-wrap gap-1.5">
                <Insignia tono={ESTADO_PEDIDO[p.estado].tono}>{textoEstadoPedido(p.estado, p.tomadoPor?.nombre)}</Insignia>
                {p.prioridad === "URGENTE" && p.estado === "PENDIENTE" && <Insignia tono="critico">Urgente</Insignia>}
              </span>
            </>
          }
        />
      ))}
    </Lista>
  );
}
