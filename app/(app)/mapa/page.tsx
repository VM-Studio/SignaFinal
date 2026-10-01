import type { Metadata } from "next";
import { requerirUsuario } from "@/lib/auth/usuario-actual";
import { datosMapa } from "@/lib/datos/mapa";
import { Titulo } from "@/components/ui/basicos";
import { MapaEnVivo } from "@/components/mapa/mapa-en-vivo";

export const metadata: Metadata = { title: "Mapa" };

export default async function PaginaMapa() {
  await requerirUsuario("mapa.ver");
  const datos = await datosMapa();
  return (
    <div>
      <Titulo detalle="Dónde está cada vehículo. Se actualiza cada 15 segundos.">Mapa</Titulo>
      <MapaEnVivo inicial={datos} alto="h-[62dvh] lg:h-[calc(100dvh-12rem)]" />
    </div>
  );
}
