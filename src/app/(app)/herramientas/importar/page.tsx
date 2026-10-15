import type { Metadata } from "next";
import { exigirPermiso } from "@/lib/auth/sesion";
import { Titulo } from "@/components/ui/basicos";
import { ImportarCSV } from "@/components/herramientas/importar";

export const metadata: Metadata = { title: "Importar herramientas" };

export default async function PaginaImportar() {
  await exigirPermiso("herramientas.editar");
  return (
    <div>
      <Titulo siempre>Importar herramientas</Titulo>
      <ImportarCSV />
    </div>
  );
}
