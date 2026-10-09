import type { Metadata } from "next";
import { exigirPermiso } from "@/lib/auth/sesion";
import { db } from "@/lib/db";
import { colaCompras } from "@/lib/materiales/consultas";
import { PESTANAS_COMPRAS, type PestanaCompras } from "@/lib/materiales/presentacion";
import { Insignia } from "@/components/ui/basicos";
import { ListaDetalle } from "@/components/ui/lista-detalle";
import { DetalleMaterial } from "@/components/materiales/detalle-material";

export const metadata: Metadata = { title: "Pedido de material" };

/** En escritorio, al lado de la cola de su misma pestaña. */
export default async function PaginaMaterialCompras({ params }: { params: Promise<{ id: string }> }) {
  await exigirPermiso("materiales.gestionar");
  const { id } = await params;
  const actual = await db.pedidoMaterial.findUnique({ where: { id }, select: { estado: true } });
  const pestana = ((Object.keys(PESTANAS_COMPRAS) as PestanaCompras[]).find((k) => actual && (PESTANAS_COMPRAS[k].estados as readonly string[]).includes(actual.estado)) ?? "nuevos");
  const { filas } = await colaCompras(pestana, undefined, 50);
  return (
    <ListaDetalle
      titulo={PESTANAS_COMPRAS[pestana].titulo}
      verTodo={pestana === "nuevos" ? "/compras" : `/compras?p=${pestana}`}
      activo={id}
      items={filas.map((f) => ({
        id: f.id,
        href: `/compras/${f.id}`,
        titulo: `#${f.numero} · ${f.descripcion.split("\n")[0]}`,
        detalle: `Obra ${f.obra} · ${f.solicitante}`,
        derecha: f.prioridad === "URGENTE" ? <Insignia tono="critico">Urgente</Insignia> : f.demorado ? <Insignia tono="critico">Demorado</Insignia> : undefined,
      }))}
    >
      <DetalleMaterial id={id} vista="compras" />
    </ListaDetalle>
  );
}
