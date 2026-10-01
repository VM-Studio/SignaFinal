import type { ReactNode } from "react";
import { Titulo, Vacio } from "@/components/ui/basicos";
import { ICONOS } from "./iconos";
import type { Icono } from "@/lib/navegacion";

/** Sección todavía sin lógica: título (escritorio) y estado vacío que explica qué va a haber. */
export function PaginaVacia({ titulo, icono, texto, accion }: { titulo: string; icono: Icono; texto: ReactNode; accion?: ReactNode }) {
  const I = ICONOS[icono];
  return (
    <div className="mx-auto max-w-3xl lg:max-w-none">
      <Titulo>{titulo}</Titulo>
      <Vacio icono={<I className="size-10" />} titulo={`${titulo}: todavía sin datos`} accion={accion}>
        {texto}
      </Vacio>
    </div>
  );
}
