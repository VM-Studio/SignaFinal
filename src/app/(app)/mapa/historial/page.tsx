import type { Metadata } from "next";
import { historial } from "@/lib/mapa/consultas";
import { Titulo } from "@/components/ui/basicos";
import { Fecha, Selector } from "@/components/ui/campos";
import { ColumnaMapa } from "@/components/ui/columna-mapa";
import { claseBoton } from "@/components/ui/boton";
import { Reproductor, SinMapa } from "@/components/mapa/reproductor";
import { VolverAlMapa } from "@/components/mapa/mapa-en-vivo";
import { diaISO } from "@/lib/formato";

export const metadata: Metadata = { title: "Historial de recorridos" };

export default async function PaginaHistorial({ searchParams }: { searchParams: Promise<{ vehiculo?: string; dia?: string }> }) {
  const sp = await searchParams;
  const dia = sp.dia && /^\d{4}-\d{2}-\d{2}$/.test(sp.dia) ? sp.dia : diaISO();
  const h = await historial(sp.vehiculo, dia); // verifica mapa.ver
  const nombre = h.vehiculos.find((v) => v.id === sp.vehiculo)?.nombre;
  const cabecera = (
    <>
      <div>
        <VolverAlMapa />
        <Titulo detalle="Recorrido real de Cusat: paradas, km del día y los viajes del sistema. Se puede reproducir.">Historial</Titulo>
      </div>
      <form className="grid grid-cols-[1fr_auto] gap-2" action="/mapa/historial">
        <div className="col-span-2">
          <Selector name="vehiculo" defaultValue={sp.vehiculo ?? ""} aria-label="Vehículo">
            <option value="">Elegí el vehículo</option>
            {h.vehiculos.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
          </Selector>
        </div>
        <Fecha name="dia" defaultValue={dia} max={diaISO()} aria-label="Día" />
        <button className={claseBoton("primario")}>Ver</button>
      </form>
    </>
  );
  if (!sp.vehiculo) return <ColumnaMapa arriba={cabecera} mapa={<SinMapa />} />;
  return <Reproductor key={`${sp.vehiculo}-${dia}`} cabecera={cabecera} nombre={nombre ?? ""} rastro={h.rastro} paradas={h.paradas} km={h.km} viajes={h.viajes} />;
}
