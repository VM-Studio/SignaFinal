import Link from "next/link";
import type { Metadata } from "next";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { Download } from "lucide-react";
import { requerirUsuario } from "@/lib/auth/usuario-actual";
import { costosPorObra, costosPorVehiculo, periodoDesdeParams } from "@/lib/datos/costos";
import { Cifra, Subtitulo, Tabla, Titulo, Vacio } from "@/components/ui/basicos";
import { claseBoton } from "@/components/ui/boton";
import { km, num, plata } from "@/lib/formato";

export const metadata: Metadata = { title: "Costos" };

const iso = (d: Date) => format(d, "yyyy-MM-dd");

export default async function PaginaCostos({ searchParams }: { searchParams: Promise<{ desde?: string; hasta?: string }> }) {
  await requerirUsuario("costos.ver");
  const params = await searchParams;
  const periodo = periodoDesdeParams(params);
  const [obras, vehiculos] = await Promise.all([costosPorObra(periodo), costosPorVehiculo(periodo)]);
  const total = obras.reduce((a, o) => a + o.costo, 0);
  const totalKm = obras.reduce((a, o) => a + o.km, 0);
  const totalViajes = obras.reduce((a, o) => a + o.viajes, 0);
  const combustible = vehiculos.reduce((a, v) => a + v.combustible, 0);
  const mantenimiento = vehiculos.reduce((a, v) => a + v.mantenimiento, 0);
  const qsPeriodo = `desde=${iso(periodo.desde)}&hasta=${iso(periodo.hasta)}`;

  const hoy = new Date();
  const meses = [0, 1, 2].map((n) => {
    const m = subMonths(hoy, n);
    return { etiqueta: format(m, "MMMM", { locale: es }), desde: iso(startOfMonth(m)), hasta: iso(endOfMonth(m)) };
  });

  return (
    <div>
      <Titulo detalle={`Del ${format(periodo.desde, "d MMM", { locale: es })} al ${format(periodo.hasta, "d MMM yyyy", { locale: es })}`}>Costos</Titulo>

      <form className="mb-5 flex flex-wrap items-end gap-2" action="/costos">
        {meses.map((m) => (
          <Link
            key={m.desde}
            href={`/costos?desde=${m.desde}&hasta=${m.hasta}`}
            className={`grid min-h-11 place-items-center rounded-md px-4 text-sm font-semibold capitalize ${iso(periodo.desde) === m.desde && iso(periodo.hasta) === m.hasta ? "bg-negro text-white" : "bg-papel border border-linea"}`}
          >
            {m.etiqueta}
          </Link>
        ))}
        <label className="flex flex-col text-xs font-semibold text-suave">
          Desde
          <input type="date" name="desde" defaultValue={iso(periodo.desde)} className="mt-1 min-h-11 rounded-md border-2 border-linea bg-papel px-2 text-tinta" />
        </label>
        <label className="flex flex-col text-xs font-semibold text-suave">
          Hasta
          <input type="date" name="hasta" defaultValue={iso(periodo.hasta)} className="mt-1 min-h-11 rounded-md border-2 border-linea bg-papel px-2 text-tinta" />
        </label>
        <button className={claseBoton("secundario", "chico")}>Ver</button>
      </form>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3">
        <Cifra etiqueta="Viajes a obras" valor={plata(total)} detalle={`${num(totalViajes)} viajes · ${km(totalKm)}`} />
        <Cifra etiqueta="Combustible" valor={plata(combustible)} />
        <Cifra etiqueta="Mantenimiento" valor={plata(mantenimiento)} />
        <Cifra etiqueta="Costo medio por viaje" valor={plata(totalViajes ? total / totalViajes : 0)} />
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {[
          ["viajes", "Viajes"],
          ["obras", "Por obra"],
          ["vehiculos", "Por vehículo"],
          ["combustible", "Combustible"],
          ["mantenimiento", "Mantenimiento"],
        ].map(([t, e]) => (
          <a key={t} href={`/api/exportar/${t}?${qsPeriodo}`} className={claseBoton("fantasma", "chico", false, "underline")}>
            <Download className="size-4" /> {e} (Excel)
          </a>
        ))}
      </div>

      <div className="grid gap-x-6 lg:grid-cols-2">
        <section>
          <Subtitulo>Por obra</Subtitulo>
          {obras.length === 0 ? (
            <Vacio titulo="Sin viajes terminados en el período" />
          ) : (
            <Tabla>
              <thead>
                <tr>
                  <th>Obra</th>
                  <th className="text-right">Viajes</th>
                  <th className="text-right">Km</th>
                  <th className="text-right">Costo</th>
                </tr>
              </thead>
              <tbody>
                {obras.map((o) => (
                  <tr key={o.obraId}>
                    <td className="font-semibold">
                      <Link href={`/obras/${o.obraId}`} className="hover:underline">
                        Obra {o.obra}
                      </Link>
                      <div className="mt-1 h-1.5 rounded-full bg-fondo">
                        <div className="h-full rounded-full bg-negro" style={{ width: `${total ? (o.costo / total) * 100 : 0}%` }} />
                      </div>
                    </td>
                    <td className="text-right tabular-nums">{o.viajes}</td>
                    <td className="text-right tabular-nums">{km(o.km)}</td>
                    <td className="text-right font-semibold tabular-nums">{plata(o.costo)}</td>
                  </tr>
                ))}
              </tbody>
            </Tabla>
          )}
        </section>
        <section>
          <Subtitulo>Por vehículo</Subtitulo>
          {vehiculos.length === 0 ? (
            <Vacio titulo="Sin movimientos en el período" />
          ) : (
            <Tabla>
              <thead>
                <tr>
                  <th>Vehículo</th>
                  <th className="text-right">Viajes</th>
                  <th className="text-right">Combustible</th>
                  <th className="text-right">Mantenim.</th>
                </tr>
              </thead>
              <tbody>
                {vehiculos.map((v) => (
                  <tr key={v.vehiculoId}>
                    <td className="font-semibold">
                      <Link href={`/flota/${v.vehiculoId}`} className="hover:underline">
                        {v.vehiculo}
                      </Link>
                      <span className="block text-sm font-normal text-suave">{km(v.km)}</span>
                    </td>
                    <td className="text-right tabular-nums">{plata(v.costoViajes)}</td>
                    <td className="text-right tabular-nums">{plata(v.combustible)}</td>
                    <td className="text-right tabular-nums">{plata(v.mantenimiento)}</td>
                  </tr>
                ))}
              </tbody>
            </Tabla>
          )}
        </section>
      </div>
    </div>
  );
}
