import type { Metadata } from "next";
import { exigirPermiso } from "@/lib/auth/sesion";
import { datosFormulario } from "@/lib/pedidos/consultas";
import { datosCoordinar } from "@/lib/materiales/consultas";
import { Titulo } from "@/components/ui/basicos";
import { CoordinarViaje } from "@/components/pedidos/coordinar-viaje";
import { PestanasViajesCompras } from "@/components/pedidos/pestanas-viajes-compras";

export const metadata: Metadata = { title: "Coordinar viaje" };

/** Compras pide un viaje para las arquitectas (a nombre de ellas). */
export default async function PaginaCoordinar() {
  await exigirPermiso("pedidos.coordinar");
  const [datos, { obras, listos }] = await Promise.all([datosFormulario(), datosCoordinar()]);
  return (
    <div>
      <Titulo siempre detalle="Pedí un viaje para alguien de obra: sale a su nombre y les avisamos a los dos.">Viajes</Titulo>
      <PestanasViajesCompras activa="coordinar" />
      <div className="max-w-none lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] lg:gap-6">
        <CoordinarViaje datos={datos} obras={obras} listos={listos} />
        <aside className="hidden lg:block">
          <div className="sticky top-[72px] rounded-[var(--radius-caja)] border border-linea bg-papel p-4 text-sm text-suave">
            <p className="etiqueta mb-2">Cómo funciona</p>
            <p>Elegí la obra y para quién es. El chofer ve “Pidió Daniela · coordinó vos”.</p>
            <p className="mt-2">Para un retiro en proveedor, elegí “Retirar en un proveedor”: aparece lo que habilitaste para esa obra.</p>
            <p className="mt-2">En Solicitudes ves todos los viajes, agrupados por lugar de retiro, y podés editar o cancelar los pendientes.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
