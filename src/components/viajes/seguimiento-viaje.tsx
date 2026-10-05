import type { EtapaViaje } from "@prisma/client";
import { Truck } from "lucide-react";
import { etapaEnPalabras } from "@/lib/pedidos/palabras";
import { hora } from "@/lib/formato";

const PASOS: { etapa: EtapaViaje; titulo: string }[] = [
  { etapa: "HACIA_RETIRO", titulo: "Va a retirar" },
  { etapa: "EN_RETIRO", titulo: "Cargando" },
  { etapa: "HACIA_DESTINO", titulo: "En camino" },
  { etapa: "FINALIZADO", titulo: "Entregado" },
];

/**
 * Seguimiento del viaje para quien lo pidió. Por ahora muestra la etapa y la hora estimada;
 * el mapa en vivo con la posición del chofer se suma acá (prompt 5).
 */
export function SeguimientoViaje({ etapa, origen, chofer, vehiculo, etaRetiro, etaDestino }: {
  etapa: EtapaViaje; origen: string; chofer: string; vehiculo: string; etaRetiro: Date | null; etaDestino: Date | null;
}) {
  const actual = PASOS.findIndex((p) => p.etapa === etapa);
  const eta = etapa === "HACIA_RETIRO" ? etaRetiro : etaDestino;
  return (
    <section aria-label="Seguimiento del viaje" className="mt-3 rounded-[var(--radius-caja)] border-2 border-negro bg-papel p-4">
      <div className="flex items-center gap-3">
        <Truck className="size-7 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold">{etapaEnPalabras(etapa, origen)}</p>
          <p className="text-suave">{chofer} · {vehiculo}</p>
        </div>
        {eta && etapa !== "FINALIZADO" && (
          <div className="text-right">
            <p className="text-xs font-semibold tracking-wider text-suave uppercase">{etapa === "HACIA_RETIRO" ? "Al retiro" : "Llega"}</p>
            <p className="text-2xl font-bold tabular-nums">{hora(eta)}</p>
          </div>
        )}
      </div>
      <ol className="mt-4 grid grid-cols-4 gap-1">
        {PASOS.map((p, i) => (
          <li key={p.etapa}>
            <span className={`block h-1.5 rounded-full ${i <= actual ? "bg-negro" : "bg-linea"}`} />
            <span className={`mt-1 block text-xs ${i === actual ? "font-bold" : "text-suave"}`}>{p.titulo}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
