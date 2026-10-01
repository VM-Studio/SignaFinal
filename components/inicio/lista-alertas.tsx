import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Alerta } from "@prisma/client";
import { Estado } from "@/components/ui/estado";
import { hace } from "@/lib/formato";

export function ListaAlertas({ alertas, resueltas = false }: { alertas: Alerta[]; resueltas?: boolean }) {
  return (
    <ul className="flex flex-col divide-y divide-linea overflow-hidden rounded-[var(--radius-caja)] border border-linea bg-papel">
      {alertas.map((a) => {
        const contenido = (
          <>
            <div className="min-w-0 flex-1">
              <p className={`font-semibold ${resueltas ? "text-suave line-through" : ""}`}>{a.titulo}</p>
              <p className="text-sm text-suave">{a.detalle}</p>
              <p className="mt-0.5 text-xs text-apagado">{resueltas && a.resueltaEn ? `Se resolvió ${hace(a.resueltaEn)}` : `Desde ${hace(a.creadaEn)}`}</p>
            </div>
            {resueltas ? (
              <Estado tono="ok">Resuelta</Estado>
            ) : (
              <Estado tono={a.severidad === "CRITICO" ? "critico" : "aviso"}>{a.severidad === "CRITICO" ? "Crítica" : "Aviso"}</Estado>
            )}
            {a.href && <ChevronRight className="size-5 shrink-0 text-apagado" />}
          </>
        );
        return (
          <li key={a.id}>
            {a.href ? (
              <Link href={a.href} className="flex items-center gap-3 px-4 py-3 hover:bg-fondo/60">
                {contenido}
              </Link>
            ) : (
              <div className="flex items-center gap-3 px-4 py-3">{contenido}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
