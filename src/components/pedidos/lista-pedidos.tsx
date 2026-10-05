import { Truck } from "lucide-react";
import { FilaLista, Insignia, Lista } from "@/components/ui/basicos";
import { ESTADO_PEDIDO } from "@/lib/etiquetas";
import { cuando } from "@/lib/formato";
import { estadoEnPalabras, etapaEnPalabras, horaEstimada } from "@/lib/pedidos/palabras";
import type { FilaPedidoLista } from "@/lib/pedidos/listas";

/** Pedidos: qué, obra, para cuándo y el estado en palabras. base: a qué detalle lleva cada fila. */
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
              <span className="block truncate">{[p.destinoNombre, `para ${cuando(p.paraCuando)}`, conSolicitante ? `pidió ${p.solicitante.nombre}` : null].filter(Boolean).join(" · ")}</span>
              <span className="mt-1.5 flex flex-wrap gap-1.5">
                <Insignia tono={ESTADO_PEDIDO[p.estado].tono}>{estadoEnPalabras(p)}</Insignia>
                {p.prioridad === "URGENTE" && p.estado === "PENDIENTE" && <Insignia tono="critico">Urgente</Insignia>}
              </span>
            </>
          }
        />
      ))}
    </Lista>
  );
}

/** Viajes hacia mis obras: quién y con qué, qué lleva, a qué obra, en qué etapa y a qué hora. */
export function ListaViajes({ filas, base }: { filas: FilaPedidoLista[]; base: string }) {
  return (
    <Lista>
      {filas.map((p) => {
        const v = p.viaje;
        const etapa = v ? etapaEnPalabras(v.etapa, p.origenNombre, v.salidaEstimada) : estadoEnPalabras(p);
        const horaEst = v ? horaEstimada(v) : null;
        return (
          <FilaLista
            key={p.id}
            href={`${base}/${p.id}`}
            titulo={
              <span className="flex items-center gap-2">
                <Truck aria-hidden className="size-5 shrink-0" />
                <span className="truncate">{v ? `${v.chofer.nombre} · ${v.vehiculo.nombre}` : p.tomadoPor?.nombre}</span>
              </span>
            }
            detalle={
              <>
                <span className="block truncate text-tinta">{p.descripcion}</span>
                <span className="block truncate">{p.destinoNombre} · pidió {p.solicitante.nombre}</span>
                <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Insignia tono={ESTADO_PEDIDO[p.estado].tono}>{etapa}</Insignia>
                  {horaEst && <span className="font-semibold text-tinta">{horaEst}</span>}
                </span>
              </>
            }
          />
        );
      })}
    </Lista>
  );
}
