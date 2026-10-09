import type { Metadata } from "next";
import { exigirPermiso } from "@/lib/auth/sesion";
import { puede } from "@/lib/permisos";
import { opciones, sobrantes } from "@/lib/herramientas/consultas";
import { limiteDe } from "@/lib/pagina";
import { Titulo } from "@/components/ui/basicos";
import { CargarMas } from "@/components/ui/cargar-mas";
import { AgregarSobrante, Sobrantes } from "@/components/herramientas/sobrantes";

export const metadata: Metadata = { title: "Sobrantes" };

/** Materiales de construcción que sobraron de las obras y quedaron en el depósito. */
export default async function PaginaSobrantes({ searchParams }: { searchParams: Promise<{ n?: string }> }) {
  const u = await exigirPermiso("sobrantes.ver");
  const editar = puede(u.rol, "sobrantes.editar");
  const { limite, siguiente } = await limiteDe((await searchParams).n);
  const [todos, ops] = await Promise.all([sobrantes(limite), editar ? opciones() : Promise.resolve(null)]);
  return (
    <div>
      <Titulo siempre detalle="Materiales de construcción que sobraron de las obras y quedaron en el depósito." accion={ops ? <AgregarSobrante obras={ops.obras} /> : undefined}>
        Sobrantes
      </Titulo>
      <Sobrantes lista={todos.slice(0, limite)} editar={editar} />
      {todos.length > limite && <CargarMas href={`/sobrantes?n=${siguiente}`} />}
    </div>
  );
}
