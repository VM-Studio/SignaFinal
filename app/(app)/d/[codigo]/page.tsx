import { notFound, redirect } from "next/navigation";
import { requerirUsuario } from "@/lib/auth/usuario-actual";
import { db } from "@/lib/db";

/** Destino del QR: /d/MQ-0001 abre la ficha del ítem. */
export default async function AbrirCodigo({ params }: { params: Promise<{ codigo: string }> }) {
  await requerirUsuario("deposito.ver");
  const { codigo } = await params;
  const item = await db.item.findUnique({ where: { codigo: decodeURIComponent(codigo).toUpperCase() }, select: { id: true } });
  if (!item) notFound();
  redirect(`/deposito/${item.id}`);
}
