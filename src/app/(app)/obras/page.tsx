import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import { listaObras } from "@/lib/obras/consultas";
import { FilaLista, Insignia, Lista, Titulo, Vacio } from "@/components/ui/basicos";

export const metadata: Metadata = { title: "Obras" };

export default async function PaginaObras() {
  const obras = await listaObras();
  return (
    <div className="mx-auto max-w-3xl">
      <Titulo detalle="Las obras activas (vienen de Lebane).">Obras</Titulo>
      {obras.length === 0 ? (
        <Vacio icono={<Building2 className="size-10" />} titulo="No tenés obras asignadas">Pedile a la oficina que te asigne tus obras.</Vacio>
      ) : (
        <Lista>
          {obras.map((o) => (
            <FilaLista
              key={o.id}
              href={`/obras/${o.id}`}
              titulo={`Obra ${o.nombre}`}
              detalle={`${o.direccion}, ${o.localidad} · ${o.responsables.map((r) => r.usuario.nombre).join(", ") || "sin responsable"}`}
              derecha={
                <div className="flex flex-col items-end gap-1">
                  {o.estado !== "ACTIVA" && <Insignia tono="aviso">Pausada</Insignia>}
                  {o.enCurso > 0 && <Insignia tono="activo">{o.enCurso} en curso</Insignia>}
                </div>
              }
            />
          ))}
        </Lista>
      )}
    </div>
  );
}
