import type { Metadata } from "next";
import { historial } from "@/lib/mapa/consultas";
import { Titulo } from "@/components/ui/basicos";
import { Selector } from "@/components/ui/campos";
import { claseBoton } from "@/components/ui/boton";
import { Reproductor } from "@/components/mapa/reproductor";
import { VolverAlMapa } from "@/components/mapa/mapa-en-vivo";
import { diaISO } from "@/lib/formato";

export const metadata: Metadata = { title: "Historial de recorridos" };

export default async function PaginaHistorial({ searchParams }: { searchParams: Promise<{ vehiculo?: string; dia?: string }> }) {
  const sp = await searchParams;
  const dia = sp.dia && /^\d{4}-\d{2}-\d{2}$/.test(sp.dia) ? sp.dia : diaISO();
  const h = await historial(sp.vehiculo, dia); // verifica mapa.ver
  const nombre = h.vehiculos.find((v) => v.id === sp.vehiculo)?.nombre;
  return (
    <div className="mx-auto max-w-5xl">
      <VolverAlMapa />
      <Titulo siempre detalle="Elegí vehículo y día: se ve el recorrido completo y se puede reproducir.">Historial</Titulo>
      <form className="mb-4 grid gap-2 sm:grid-cols-[1fr_12rem_auto]" action="/mapa/historial">
        <Selector name="vehiculo" defaultValue={sp.vehiculo ?? ""} aria-label="Vehículo">
          <option value="">Elegí el vehículo</option>
          {h.vehiculos.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
        </Selector>
        <input type="date" name="dia" defaultValue={dia} max={diaISO()} aria-label="Día" className="min-h-[52px] rounded-[var(--radius-caja)] border-2 border-linea bg-papel px-3" />
        <button className={claseBoton("primario")}>Ver</button>
      </form>
      {sp.vehiculo && <Reproductor key={`${sp.vehiculo}-${dia}`} nombre={nombre ?? ""} rastro={h.rastro} paradas={h.paradas} />}
    </div>
  );
}
