import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { requerirUsuario } from "@/lib/auth/usuario-actual";
import { alertasPara } from "@/lib/datos/alertas";
import { Subtitulo, Titulo, Vacio } from "@/components/ui/basicos";
import { ListaAlertas } from "@/components/inicio/lista-alertas";
import { BotonRecalcular } from "./recalcular";

export const metadata: Metadata = { title: "Alertas" };

const AREAS = { FLOTA: "Flota", PEDIDOS: "Pedidos y viajes", DEPOSITO: "Depósito", PERSONAS: "Personas" } as const;

export default async function PaginaAlertas() {
  const u = await requerirUsuario("alertas.ver");
  const { activas, resueltas } = await alertasPara(u);
  const criticas = activas.filter((a) => a.severidad === "CRITICO").length;

  return (
    <div className="mx-auto max-w-3xl">
      <Titulo
        detalle={activas.length ? `${activas.length} activas${criticas ? `, ${criticas} críticas` : ""}. Se resuelven solas cuando se arregla el problema.` : undefined}
        accion={<BotonRecalcular />}
      >
        {u.rol === "CHOFER" || u.rol === "RESPONSABLE_OBRA" ? "Avisos" : "Alertas"}
      </Titulo>

      {activas.length === 0 ? (
        <Vacio titulo="Todo en orden" icono={<CheckCircle2 className="size-8 text-ok" />}>
          No hay nada que necesite atención.
        </Vacio>
      ) : (
        (Object.keys(AREAS) as (keyof typeof AREAS)[]).map((area) => {
          const lista = activas.filter((a) => a.area === area);
          if (!lista.length) return null;
          return (
            <section key={area}>
              <Subtitulo>{AREAS[area]}</Subtitulo>
              <ListaAlertas alertas={lista} />
            </section>
          );
        })
      )}

      {resueltas.length > 0 && (
        <section>
          <Subtitulo>Resueltas esta semana</Subtitulo>
          <ListaAlertas alertas={resueltas} resueltas />
        </section>
      )}
    </div>
  );
}
