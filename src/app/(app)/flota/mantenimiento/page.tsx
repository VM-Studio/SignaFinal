import Link from "next/link";
import type { Metadata } from "next";
import { exigirPermiso } from "@/lib/auth/sesion";
import { db } from "@/lib/db";
import { FilaLista, Insignia, Lista, Subtitulo, Titulo, Vacio } from "@/components/ui/basicos";
import { diaISO, fecha, km, plata } from "@/lib/formato";

export const metadata: Metadata = { title: "Mantenimiento" };

const TIPO = { SERVICE: "Service", REPARACION: "Reparación", NEUMATICOS: "Neumáticos", OTRO: "Otro" } as const;

export default async function PaginaMantenimiento() {
  await exigirPermiso("mantenimiento.ver");
  const [vehiculos, recientes] = await Promise.all([
    db.vehiculo.findMany({ where: { activo: true }, select: { id: true, nombre: true, kmActual: true, estado: true, mantenimientos: { where: { OR: [{ proximoKm: { not: null } }, { proximaFecha: { not: null } }] }, orderBy: { fecha: "desc" }, take: 1 } } }),
    db.mantenimientoVehiculo.findMany({ orderBy: { fecha: "desc" }, take: 20, include: { vehiculo: { select: { id: true, nombre: true } } } }),
  ]);
  // Próximos: los que tienen service programado, del más urgente al menos.
  const proximos = vehiculos
    .filter((v) => v.mantenimientos[0])
    .map((v) => {
      const m = v.mantenimientos[0];
      const faltan = m.proximoKm != null ? m.proximoKm - v.kmActual : null;
      const vencido = (faltan != null && faltan <= 0) || (m.proximaFecha != null && diaISO(m.proximaFecha) < diaISO());
      const cerca = (faltan != null && faltan <= 1000) || (m.proximaFecha != null && diaISO(m.proximaFecha) <= diaISO(new Date(Date.now() + 15 * 86_400_000)));
      return { v, m, faltan, vencido, cerca };
    })
    .sort((a, b) => Number(b.vencido) - Number(a.vencido) || Number(b.cerca) - Number(a.cerca) || (a.faltan ?? 1e9) - (b.faltan ?? 1e9));
  return (
    <div>
      <Titulo detalle="Lo que viene y lo último que se hizo. Para registrar, entrá a la ficha del vehículo.">Mantenimiento</Titulo>
      <Subtitulo>Próximos</Subtitulo>
      {proximos.length === 0 ? (
        <Vacio titulo="No hay mantenimientos programados" />
      ) : (
        <Lista>
          {proximos.map(({ v, m, faltan, vencido, cerca }) => (
            <FilaLista
              key={v.id}
              href={`/flota/${v.id}?tab=mantenimiento`}
              titulo={v.nombre}
              detalle={[m.proximoKm != null && `A los ${km(m.proximoKm)} (tiene ${km(v.kmActual)})`, m.proximaFecha && `el ${fecha(m.proximaFecha)}`].filter(Boolean).join(" · ")}
              derecha={vencido ? <Insignia tono="critico">Atrasado</Insignia> : cerca ? <Insignia tono="aviso">{faltan != null ? `Faltan ${km(faltan)}` : "Pronto"}</Insignia> : <Insignia tono="ok">Al día</Insignia>}
            />
          ))}
        </Lista>
      )}
      <Subtitulo>Últimos registrados</Subtitulo>
      {recientes.length === 0 ? (
        <Vacio titulo="Sin mantenimientos registrados" />
      ) : (
        <Lista>
          {recientes.map((m) => (
            <FilaLista key={m.id} href={`/flota/${m.vehiculo.id}?tab=mantenimiento`} titulo={`${m.vehiculo.nombre} · ${TIPO[m.tipo]}`} detalle={`${fecha(m.fecha)} · ${m.descripcion}`} derecha={<span className="font-semibold tabular-nums">{plata(Number(m.costo))}</span>} />
          ))}
        </Lista>
      )}
      <p className="mt-4 text-sm"><Link href="/flota" className="font-semibold underline">Ir a la flota</Link></p>
    </div>
  );
}
