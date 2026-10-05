import { exigirSesion } from "@/lib/auth/sesion";
import { pantallaViaje } from "@/lib/viajes/chofer";
import { PantallaViaje } from "@/components/viajes/pantalla-viaje";
import PaginaPedido from "@/components/pedidos/pagina-detalle";

export { generateMetadata } from "@/components/pedidos/pagina-detalle";

/** El chofer con su viaje: la pantalla de manejo. Si todavía no es suyo (una solicitud), el detalle para aceptarla. */
export default async function PaginaViaje(props: { params: Promise<{ id: string }> }) {
  const u = await exigirSesion();
  if (u.rol === "CHOFER") {
    const d = await pantallaViaje((await props.params).id);
    if (d) return <PantallaViaje d={d} />;
  }
  return <PaginaPedido params={props.params} />;
}
