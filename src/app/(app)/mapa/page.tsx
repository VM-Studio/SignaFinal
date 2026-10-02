import Link from "next/link";
import type { Metadata } from "next";
import { History } from "lucide-react";
import { datosMapa } from "@/lib/mapa/consultas";
import { Titulo } from "@/components/ui/basicos";
import { claseBoton } from "@/components/ui/boton";
import { MapaEnVivo } from "@/components/mapa/mapa-en-vivo";

export const metadata: Metadata = { title: "Mapa" };

export default async function PaginaMapa({ searchParams }: { searchParams: Promise<{ vehiculo?: string }> }) {
  const [datos, { vehiculo }] = await Promise.all([datosMapa(), searchParams]); // verifica mapa.ver
  return (
    <div>
      <Titulo detalle="Se actualiza solo cada 30 segundos." accion={<Link href="/mapa/historial" className={claseBoton("secundario", "chico")}><History className="size-4" /> Historial</Link>}>Mapa</Titulo>
      <MapaEnVivo inicial={datos} elegidoInicial={vehiculo} />
    </div>
  );
}
