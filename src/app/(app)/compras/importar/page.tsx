import type { Metadata } from "next";
import { exigirPermiso } from "@/lib/auth/sesion";
import { Titulo } from "@/components/ui/basicos";
import { ImportarTablero } from "@/components/compras/importar-tablero";
import { PestanasOrdenes } from "@/components/compras/pestanas-compras";

export const metadata: Metadata = { title: "Importar tablero" };

/** Importar el historial de Compras desde su Excel (opcional, cuando ella quiera). Compras y el dueño. */
export default async function PaginaImportar() {
  await exigirPermiso("materiales.gestionar");
  return (
    <div>
      <Titulo siempre detalle="Cargá tu tablero de control de Excel: se revisa fila por fila antes de guardar.">Importar desde Excel</Titulo>
      <PestanasOrdenes activa="importar" />
      <ImportarTablero />
    </div>
  );
}
