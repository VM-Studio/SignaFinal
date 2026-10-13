import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { pantallaViaje } from "@/lib/viajes/chofer";
import { ModoConduccion } from "@/components/viajes/modo-conduccion";

export const metadata: Metadata = { title: "Modo conducción" };

/** Modo conducción del chofer: solo con el viaje en curso (antes de salir o ya terminado, la pantalla del viaje). */
export default async function PaginaConducir({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await pantallaViaje(id);
  if (!d || d.estado !== "EN_CURSO") redirect(`/viaje/${id}`);
  return <ModoConduccion d={d} />;
}
