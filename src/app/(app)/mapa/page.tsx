import type { Metadata } from "next";
import { datosMapa } from "@/lib/mapa/consultas";
import { Titulo } from "@/components/ui/basicos";
import { Mapa } from "@/components/mapa/mapa";

export const metadata: Metadata = { title: "Mapa" };

export default async function PaginaMapa() {
  const d = await datosMapa(); // verifica mapa.ver
  return (
    <div>
      <Titulo detalle="Última posición de cada vehículo.">Mapa</Titulo>
      <Mapa vehiculos={d.vehiculos} lugares={d.lugares} alto="h-[62dvh] lg:h-[calc(100dvh-10rem)]" />
    </div>
  );
}
