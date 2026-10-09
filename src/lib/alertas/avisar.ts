import "server-only";
import { notificarEvento } from "@/lib/notificaciones/enviar";
import { EVENTO } from "@/lib/notificaciones/eventos";
import type { AlertaCalculada } from "./tipos";

/** Aviso de las alertas nuevas (una sola vez, al crearse o al pasar a críticas), según la matriz de eventos.ts. */
export async function avisarAlertas(nuevas: (AlertaCalculada & { personas: string[] })[]) {
  for (const a of nuevas) {
    try {
      await notificarEvento(EVENTO.alerta({ regla: a.regla, severidad: a.severidad, titulo: a.titulo, detalle: a.detalle, enlace: a.enlace, claveUnica: a.claveUnica, obraId: a.obraId ?? null, personas: a.personas }));
    } catch (e) {
      console.error("No se pudo avisar la alerta", a.claveUnica, e);
    }
  }
}
