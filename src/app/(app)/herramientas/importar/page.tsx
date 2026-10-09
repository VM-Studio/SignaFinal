import type { Metadata } from "next";
import { exigirPermiso } from "@/lib/auth/sesion";
import { Titulo } from "@/components/ui/basicos";
import { ImportarCSV } from "@/components/herramientas/importar";

export const metadata: Metadata = { title: "Importar herramientas" };

export default async function PaginaImportar() {
  await exigirPermiso("herramientas.editar");
  return (
    <div>
      <Titulo siempre detalle="Alta masiva desde una planilla. Ves todo antes de cargar; si una fila tiene error, no se carga nada.">Importar herramientas</Titulo>
      <ImportarCSV />
    </div>
  );
}
