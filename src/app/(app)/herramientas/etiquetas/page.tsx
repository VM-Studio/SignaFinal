import type { Metadata } from "next";
import { paraEtiquetas } from "@/lib/herramientas/consultas";
import { Titulo } from "@/components/ui/basicos";
import { ElegirEtiquetas } from "@/components/herramientas/elegir-etiquetas";

export const metadata: Metadata = { title: "Etiquetas QR" };

export default async function PaginaEtiquetas() {
  const items = await paraEtiquetas(); // verifica herramientas.editar
  return (
    <div className="mx-auto max-w-3xl">
      <Titulo siempre detalle="Elegí cuáles y se arma una hoja A4 con QR, código y nombre (24 por hoja).">Etiquetas QR</Titulo>
      <ElegirEtiquetas items={items.map((i) => ({ id: i.id, codigo: i.codigo, nombre: i.nombre, esMaquina: i.esMaquina, tipoControl: i.tipoControl, categoria: i.categoria.nombre }))} />
    </div>
  );
}
