import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { listarAlertas } from "@/lib/datos/alertas";
import { FilaLista, Insignia, Lista, Titulo, Vacio } from "@/components/ui/basicos";
import { cuando } from "@/lib/formato";

export const metadata: Metadata = { title: "Alertas" };

export default async function PaginaAlertas() {
  const alertas = await listarAlertas(); // verifica alertas.ver y filtra por rol
  return (
    <div className="mx-auto max-w-3xl">
      <Titulo detalle="Se resuelven solas cuando se arregla el problema.">Alertas</Titulo>
      {alertas.length === 0 ? (
        <Vacio icono={<CheckCircle2 className="size-10 text-ok" />} titulo="Todo en orden">No hay nada que necesite atención.</Vacio>
      ) : (
        <Lista>
          {alertas.map((a) => (
            <FilaLista
              key={a.id}
              titulo={a.titulo}
              detalle={`${a.detalle} · ${cuando(a.creadaEn)}`}
              derecha={<Insignia tono={a.severidad === "CRITICA" ? "critico" : "aviso"}>{a.severidad === "CRITICA" ? "Crítica" : "Aviso"}</Insignia>}
            />
          ))}
        </Lista>
      )}
    </div>
  );
}
