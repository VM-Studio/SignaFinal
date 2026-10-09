import { exigirPermiso } from "@/lib/auth/sesion";
import { db } from "@/lib/db";
import { cola } from "@/lib/pedidos/consultas";
import { textoParaCuando } from "@/lib/pedidos/presentacion";
import { Insignia } from "@/components/ui/basicos";
import { ListaDetalle } from "@/components/ui/lista-detalle";
import PaginaPedido from "@/components/pedidos/pagina-detalle";

export { generateMetadata } from "@/components/pedidos/pagina-detalle";

/**
 * Mismo detalle para todos los roles: cada uno ve solo los pedidos de su alcance (pedidosVisibles).
 * En escritorio, Dirección lo ve al lado de la cola (pendientes o en curso, según el pedido).
 */
export default async function PaginaSolicitud(props: { params: Promise<{ id: string }> }) {
  const u = await exigirPermiso("pedidos.ver");
  if (u.rol === "CHOFER") return <PaginaPedido params={props.params} />;
  const { id } = await props.params;
  const actual = await db.pedidoViaje.findUnique({ where: { id }, select: { estado: true } });
  const filtro = actual?.estado === "TOMADO" || actual?.estado === "EN_VIAJE" ? "en-curso" : "pendientes";
  const { pedidos } = await cola(filtro, 50);
  return (
    <ListaDetalle
      titulo={filtro === "en-curso" ? "En curso" : "Pendientes"}
      verTodo={filtro === "en-curso" ? "/solicitudes?filtro=en-curso" : "/solicitudes"}
      activo={id}
      items={pedidos.map((p) => ({
        id: p.id,
        href: `/solicitudes/${p.id}`,
        titulo: p.descripcion,
        detalle: `Obra ${p.obra.nombre} · ${textoParaCuando(p.paraCuando, p.franja)}`,
        derecha: p.prioridad === "URGENTE" ? <Insignia tono="critico">Urgente</Insignia> : undefined,
      }))}
    >
      <PaginaPedido params={props.params} />
    </ListaDetalle>
  );
}
