import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { exigirPermiso } from "@/lib/auth/sesion";
import { puede } from "@/lib/permisos";
import { alertasAbiertas, alertasResueltasRecientes } from "@/lib/alertas/consultas";
import { Insignia, Subtitulo, Titulo, Vacio } from "@/components/ui/basicos";
import { claseBoton } from "@/components/ui/boton";
import { BotonRevisar, BotonVista } from "@/components/alertas/botones";
import { cuando } from "@/lib/formato";

export const metadata: Metadata = { title: "Alertas" };

/** Qué dice el botón que lleva a resolver cada tipo de alerta. */
const RESOLVER: Record<string, string> = {
  URGENTE_SIN_TOMAR: "Ver el pedido",
  PENDIENTE_HOY: "Ver el pedido",
  DUPLICADO: "Comparar",
  VIAJE_LARGO: "Ver el viaje",
  DOCUMENTO: "Renovar documento",
  LICENCIA: "Actualizar licencia",
  SERVICE: "Registrar service",
  CONSUMO: "Ver cargas",
  DEVOLUCION_VENCIDA: "Registrar devolución",
  MAQUINA_OBRA_PARADA: "Ver la máquina",
  MANT_MAQUINA: "Registrar mantenimiento",
  FUERA_HORARIO: "Ver en el mapa",
  PARADO_EN_VIAJE: "Ver en el mapa",
};

export default async function PaginaAlertas() {
  const u = await exigirPermiso("alertas.ver");
  const [abiertas, resueltas] = await Promise.all([alertasAbiertas(), alertasResueltasRecientes()]);
  const criticas = abiertas.filter((a) => a.severidad === "CRITICA");
  const avisos = abiertas.filter((a) => a.severidad === "AVISO");

  return (
    <div className="mx-auto max-w-3xl">
      <Titulo siempre detalle="Se resuelven solas cuando se arregla el problema." accion={puede(u.rol, "costos.ver") ? <BotonRevisar /> : undefined}>Alertas</Titulo>
      {abiertas.length === 0 && <Vacio icono={<CheckCircle2 className="size-10 text-ok" />} titulo="Todo en orden">No hay nada que necesite atención.</Vacio>}
      {[["Críticas", criticas], ["Avisos", avisos]].map(([titulo, lista]) =>
        (lista as typeof abiertas).length ? (
          <section key={titulo as string}>
            <Subtitulo>{titulo as string} ({(lista as typeof abiertas).length})</Subtitulo>
            <ul className="flex flex-col gap-2">
              {(lista as typeof abiertas).map((a) => {
                const pedidos = a.regla === "DUPLICADO" ? a.entidadId.split(",") : [];
                return (
                  <li key={a.id} className={`rounded-[var(--radius-caja)] border bg-papel p-4 ${a.severidad === "CRITICA" ? "border-2 border-critico" : "border-linea"} ${a.estado === "VISTA" ? "opacity-80" : ""}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold">{a.titulo}</p>
                        <p className="mt-0.5 text-suave">{a.detalle}</p>
                        <p className="mt-1 text-xs text-apagado">Desde {cuando(a.creadaEn)}{a.estado === "VISTA" ? " · vista" : ""}</p>
                      </div>
                      <Insignia tono={a.severidad === "CRITICA" ? "critico" : "aviso"}>{a.severidad === "CRITICA" ? "Crítica" : "Aviso"}</Insignia>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {pedidos.length === 2 ? (
                        pedidos.map((id, i) => (
                          <Link key={id} href={`/pedidos/${id}`} className={claseBoton(i === 0 ? "primario" : "secundario", "chico")}>
                            {i === 0 ? "Ver el primero" : "Ver el segundo"}
                          </Link>
                        ))
                      ) : a.enlace ? (
                        <Link href={a.enlace} className={claseBoton("primario", "chico")}>
                          {RESOLVER[a.regla] ?? "Resolver"} <ChevronRight className="size-4" />
                        </Link>
                      ) : null}
                      {a.estado === "ABIERTA" && <BotonVista id={a.id} />}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null,
      )}
      {resueltas.length > 0 && (
        <section>
          <Subtitulo>Resueltas esta semana</Subtitulo>
          <ul className="divide-y divide-linea overflow-hidden rounded-[var(--radius-caja)] border border-linea bg-papel">
            {resueltas.map((a) => (
              <li key={a.id} className="flex min-h-14 items-center gap-3 px-4 py-2">
                <span className="min-w-0 flex-1"><span className="block truncate font-medium text-suave line-through">{a.titulo}</span><span className="text-xs text-apagado">Se resolvió {cuando(a.resueltaEn)}</span></span>
                <Insignia tono="ok">Resuelta</Insignia>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
