import type { Metadata } from "next";
import { exigirPermiso } from "@/lib/auth/sesion";
import { opciones } from "@/lib/herramientas/consultas";
import { Titulo } from "@/components/ui/basicos";
import { Escaner } from "@/components/herramientas/escaner";

export const metadata: Metadata = { title: "Escanear" };

export default async function PaginaEscanear() {
  await exigirPermiso("herramientas.mover");
  const ops = await opciones();
  return (
    <div className="max-w-xl">
      <Titulo detalle="Apuntá al QR de la etiqueta. Si está en el depósito se abre para entregar; si está en obra, para registrar la devolución.">Escanear</Titulo>
      <Escaner obras={ops.obras} personas={ops.personas} />
    </div>
  );
}
