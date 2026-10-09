import { claseCampo } from "@/components/ui/campos";
import Link from "next/link";
import type { Metadata } from "next";
import { Download } from "lucide-react";
import { exigirPermiso } from "@/lib/auth/sesion";
import { costosPorObra, costosPorVehiculo, periodo } from "@/lib/costos/consultas";
import { Cifra, Pestanas, Titulo, Vacio } from "@/components/ui/basicos";
import { claseBoton } from "@/components/ui/boton";
import { aFecha, diaISO, fecha, inicioDelMes, inicioMesSiguiente, km, litros, plata } from "@/lib/formato";

export const metadata: Metadata = { title: "Costos" };

/** Los tres últimos meses como atajos. */
function meses() {
  const r: { etiqueta: string; desde: string; hasta: string }[] = [];
  let ref = new Date();
  for (let i = 0; i < 3; i++) {
    const ini = inicioDelMes(ref);
    const fin = new Date(inicioMesSiguiente(ref).getTime() - 1);
    r.push({ etiqueta: new Intl.DateTimeFormat("es-AR", { month: "long", timeZone: "America/Argentina/Buenos_Aires" }).format(aFecha(diaISO(ini), "12:00")), desde: diaISO(ini), hasta: diaISO(fin) });
    ref = new Date(ini.getTime() - 86_400_000);
  }
  return r;
}

export default async function PaginaCostos({ searchParams }: { searchParams: Promise<{ desde?: string; hasta?: string; ver?: string }> }) {
  await exigirPermiso("costos.ver");
  const sp = await searchParams;
  const p = periodo(sp);
  const ver = sp.ver === "vehiculos" ? "vehiculos" : "obras";
  const qs = (extra: Record<string, string>) => new URLSearchParams({ desde: p.desdeISO, hasta: p.hastaISO, ...extra }).toString();
  const [obras, vehiculos] = await Promise.all([costosPorObra(p), costosPorVehiculo(p)]);

  const tViajes = obras.reduce((a, o) => a + o.costoViajes, 0);
  const tComb = vehiculos.reduce((a, v) => a + v.combustible, 0);
  const tMant = vehiculos.reduce((a, v) => a + v.mantenimiento + v.incidentes, 0);
  const tKm = obras.reduce((a, o) => a + o.km, 0);
  const tN = obras.reduce((a, o) => a + o.viajes, 0);
  const maxObra = Math.max(1, ...obras.map((o) => o.total));

  return (
    <div>
      <Titulo siempre detalle={`Del ${fecha(aFecha(p.desdeISO, "12:00"))} al ${fecha(aFecha(p.hastaISO, "12:00"))}`}>Costos</Titulo>

      <form action="/costos" className="mb-6 flex flex-wrap items-end gap-2">
        <nav className="flex gap-0.5 rounded-md border border-linea bg-black/[0.03] p-0.5">
          {meses().map((m) => {
            const activo = p.desdeISO === m.desde && p.hastaISO === m.hasta;
            return (
              <Link key={m.desde} href={`/costos?${new URLSearchParams({ desde: m.desde, hasta: m.hasta, ver })}`} aria-current={activo ? "page" : undefined} className={`grid min-h-10 place-items-center rounded-[5px] px-3 text-sm font-medium capitalize lg:min-h-7 ${activo ? "bg-papel text-tinta shadow-[0_0_0_1px_var(--color-linea)]" : "text-suave hover:text-tinta"}`}>
                {m.etiqueta}
              </Link>
            );
          })}
        </nav>
        <input type="hidden" name="ver" value={ver} />
        <label className="flex flex-col gap-1 text-[12px] font-medium text-suave">Desde<input type="date" name="desde" defaultValue={p.desdeISO} className={`${claseCampo} w-40`} /></label>
        <label className="flex flex-col gap-1 text-[12px] font-medium text-suave">Hasta<input type="date" name="hasta" defaultValue={p.hastaISO} className={`${claseCampo} w-40`} /></label>
        <button className={claseBoton("secundario")}>Ver período</button>
      </form>

      <div className="mb-6 grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3">
        <Cifra etiqueta="Viajes a obras" valor={plata(tViajes)} detalle={`${tN} viajes · ${km(tKm)}`} />
        <Cifra etiqueta="Combustible" valor={plata(tComb)} />
        <Cifra etiqueta="Mantenimiento e incidentes" valor={plata(tMant)} />
        <Cifra etiqueta="Costo medio por viaje" valor={plata(tN ? tViajes / tN : 0)} />
      </div>

      <Pestanas items={[
        { href: `/costos?${qs({ ver: "obras" })}`, etiqueta: "Por obra", activa: ver === "obras" },
        { href: `/costos?${qs({ ver: "vehiculos" })}`, etiqueta: "Por vehículo", activa: ver === "vehiculos" },
      ]} />

      <div className="mb-3 flex flex-wrap gap-2">
        <a href={`/api/costos/exportar?${qs({ tipo: "obras" })}`} className={claseBoton("primario", "chico")}><Download className="size-4" /> CSV por obra (para Lebane)</a>
        <a href={`/api/costos/exportar?${qs({ tipo: "vehiculos" })}`} className={claseBoton("secundario", "chico")}><Download className="size-4" /> CSV por vehículo</a>
      </div>

      {ver === "obras" ? (
        obras.length === 0 ? (
          <Vacio titulo="Sin viajes ni combustible imputado en el período" />
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius-caja)] border border-linea bg-papel">
            <table className="tabla min-w-[720px]">
              <thead>
                <tr><th>Obra</th><th>Código Lebane</th><th className="num">Viajes</th><th className="num">Km</th><th className="num">Costo de viajes</th><th className="num">Combustible</th><th className="num">Total</th></tr>
              </thead>
              <tbody>
                {obras.map((o) => (
                  <tr key={o.obraId}>
                    <td className="font-medium">
                      Obra {o.obra}
                      <div className="mt-1 h-1.5 w-40 rounded-full bg-fondo"><div className="h-full rounded-full bg-tinta" style={{ width: `${(o.total / maxObra) * 100}%` }} /></div>
                    </td>
                    <td className="text-suave tabular-nums">{o.idLebane ?? "—"}</td>
                    <td className="num">{o.viajes}</td>
                    <td className="num">{km(o.km)}</td>
                    <td className="num">{plata(o.costoViajes)}</td>
                    <td className="num">{plata(o.combustible)} <span className="block text-xs text-suave">{o.litros ? litros(o.litros) : ""}</span></td>
                    <td className="num font-medium">{plata(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-caja)] border border-linea bg-papel">
          <table className="tabla min-w-[860px]">
            <thead>
              <tr><th>Vehículo</th><th className="num">Viajes</th><th className="num">Km</th><th className="num">Costo de viajes</th><th className="num">Combustible</th><th className="num">Mantenim.</th><th className="num">Incidentes</th><th className="num">Costo real/km</th></tr>
            </thead>
            <tbody>
              {vehiculos.map((v) => (
                <tr key={v.vehiculoId}>
                  <td className="font-medium"><Link href={`/flota/${v.vehiculoId}`} className="hover:underline">{v.vehiculo}</Link><span className="block text-[11px] font-normal text-suave">{v.patente}</span></td>
                  <td className="num">{v.viajes}</td>
                  <td className="num">{km(v.km)}</td>
                  <td className="num">{plata(v.costoViajes)}</td>
                  <td className="num">{plata(v.combustible)}</td>
                  <td className="num">{plata(v.mantenimiento)}</td>
                  <td className="num">{plata(v.incidentes)}</td>
                  <td className="num font-medium">{v.costoPorKm != null ? plata(v.costoPorKm) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
