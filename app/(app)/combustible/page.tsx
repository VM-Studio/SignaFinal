import type { Metadata } from "next";
import { subDays } from "date-fns";
import { requerirUsuario } from "@/lib/auth/usuario-actual";
import { db } from "@/lib/db";
import { Subtitulo, Tabla, Titulo, Vacio } from "@/components/ui/basicos";
import { FormularioCombustible } from "@/components/flota/formulario-combustible";
import { cuando, dec, km, plata } from "@/lib/formato";

export const metadata: Metadata = { title: "Combustible" };

export default async function PaginaCombustible() {
  const u = await requerirUsuario("combustible.cargar");
  const esChofer = u.rol === "CHOFER";
  const [vehiculos, cargas] = await Promise.all([
    db.vehiculo.findMany({
      where: { activo: true },
      // Primero los que usa esta persona: los asignados a ella.
      orderBy: [{ nombre: "asc" }],
      select: { id: true, nombre: true, patente: true, kmActual: true, asignadoAId: true },
    }),
    db.cargaCombustible.findMany({
      where: { fecha: { gte: subDays(new Date(), 30) }, ...(esChofer ? { choferId: u.id } : {}) },
      orderBy: { fecha: "desc" },
      take: 50,
      include: { vehiculo: { select: { nombre: true } }, chofer: { select: { nombre: true } } },
    }),
  ]);
  const ordenados = [...vehiculos.filter((v) => v.asignadoAId === u.id), ...vehiculos.filter((v) => v.asignadoAId !== u.id)];

  return (
    <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
      <section>
        <Titulo>Cargar combustible</Titulo>
        <FormularioCombustible vehiculos={ordenados.map((v) => ({ id: v.id, nombre: v.nombre, detalle: `${v.patente} · ${km(v.kmActual)}`, kmActual: v.kmActual }))} />
      </section>
      <section>
        <Subtitulo>{esChofer ? "Tus cargas" : "Cargas"} · últimos 30 días</Subtitulo>
        {cargas.length === 0 ? (
          <Vacio titulo="Sin cargas registradas" />
        ) : (
          <Tabla>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Vehículo</th>
                {!esChofer && <th className="hidden sm:table-cell">Cargó</th>}
                <th className="text-right">Litros</th>
                <th className="text-right">Monto</th>
              </tr>
            </thead>
            <tbody>
              {cargas.map((c) => (
                <tr key={c.id}>
                  <td className="whitespace-nowrap text-suave">{cuando(c.fecha)}</td>
                  <td className="font-medium">{c.vehiculo.nombre}</td>
                  {!esChofer && <td className="hidden sm:table-cell">{c.chofer.nombre}</td>}
                  <td className="text-right tabular-nums">{dec(Number(c.litros))}</td>
                  <td className="text-right tabular-nums">{plata(Number(c.monto))}</td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        )}
      </section>
    </div>
  );
}
