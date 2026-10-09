import Link from "next/link";
import type { ReactNode } from "react";
import { Insignia } from "@/components/ui/basicos";
import { dia, hora, km, peso } from "@/lib/formato";
import type { Tarjeta } from "@/lib/viajes/chofer";
import { PendienteEnvio } from "./pendiente-envio";

const ETAPA: Record<NonNullable<Tarjeta["etapa"]>, string> = {
  PROGRAMADO: "Aceptado",
  HACIA_RETIRO: "Yendo a retirar",
  EN_RETIRO: "Cargando",
  HACIA_DESTINO: "En camino a la obra",
  EN_DESTINO: "En la obra",
  FINALIZADO: "Entregado",
};

/** "HOY 8:30", "MAÑANA 10:30", "JUE 9 OCT 8:00". */
export const fechaGrande = (d: Date) => `${dia(d).toUpperCase()} ${hora(d)}`;

/**
 * Tarjeta del chofer: lo que necesita saber de un vistazo, con letra grande y en este orden:
 * cuándo, dónde retira, dónde entrega, qué lleva, quién pidió y con qué vehículo.
 */
export function TarjetaChofer({ t, href, accion }: { t: Tarjeta; href?: string; accion?: ReactNode; destacada?: boolean }) {
  const cuerpo = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-lg font-semibold tabular-nums">{fechaGrande(t.fecha)}</p>
        <div className="flex flex-col items-end gap-1">
          {t.urgente && <Insignia tono="critico">Urgente</Insignia>}
          {t.etapa && <Insignia tono={t.etapa === "FINALIZADO" ? "ok" : t.etapa === "PROGRAMADO" ? "aviso" : "activo"}>{ETAPA[t.etapa]}</Insignia>}
        </div>
      </div>
      <div className="mt-3">
        <p className="etiqueta">Retirar en</p>
        <p className="font-semibold">{t.retirar.nombre}</p>
        <p className="text-sm text-suave">{t.retirar.direccion}</p>
        {t.retiro && (t.retiro.horario || t.retiro.contacto || t.retiro.oc) && (
          <dl className="mt-2 grid gap-1 rounded-md bg-fondo px-3 py-2 text-sm">
            {t.retiro.horario && <div className="flex gap-2"><dt className="text-suave">Horario</dt><dd>{t.retiro.horario}</dd></div>}
            {t.retiro.contacto && <div className="flex gap-2"><dt className="text-suave">Contacto</dt><dd>{t.retiro.contacto}</dd></div>}
            {t.retiro.oc && <div className="flex gap-2"><dt className="text-suave">OC</dt><dd>{t.retiro.oc}</dd></div>}
          </dl>
        )}
      </div>
      <div className="mt-2.5">
        <p className="etiqueta">Entregar en</p>
        <p className="font-semibold">{t.entregar.nombre}</p>
        <p className="text-sm text-suave">{t.entregar.direccion}</p>
      </div>
      <p className="mt-3 border-t border-linea pt-3 font-medium">{t.que}</p>
      <p className="text-sm text-suave">
        {[`Pidió ${t.pidio}`, t.pesoKg ? `hasta ${peso(t.pesoKg)}` : null, t.necesitaCamion && !t.vehiculo ? "necesita camión" : null, t.vehiculo, t.km != null ? km(t.km) : null].filter(Boolean).join(" · ")}
      </p>
    </>
  );
  return (
    <li className="rounded-[var(--radius-caja)] border border-linea bg-papel">
      {href ? <Link href={href} className="block p-4 hover:bg-hover active:bg-hover">{cuerpo}</Link> : <div className="p-4">{cuerpo}</div>}
      <div className="flex flex-col gap-2 px-4 pb-4 empty:hidden">
        <PendienteEnvio pedidoId={t.pedidoId} />
        {accion}
      </div>
    </li>
  );
}
