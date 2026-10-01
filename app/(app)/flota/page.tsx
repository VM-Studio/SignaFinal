import Link from "next/link";
import type { Metadata } from "next";
import { Plus, Truck } from "lucide-react";
import { requerirUsuario } from "@/lib/auth/usuario-actual";
import { puede } from "@/lib/permisos";
import { db } from "@/lib/db";
import { opcionesFormularioVehiculo } from "@/lib/datos/flota";
import { Tabla, Titulo, Subtitulo, Vacio } from "@/components/ui/basicos";
import { Estado } from "@/components/ui/estado";
import { ConPanel } from "@/components/ui/panel";
import { FormularioVehiculo, VEHICULO_VACIO } from "@/components/flota/formulario-vehiculo";
import { TIPO_VEHICULO } from "@/lib/etiquetas";
import { km, peso, plata, vencimiento } from "@/lib/formato";

export const metadata: Metadata = { title: "Flota" };

function Documento({ etiqueta, fecha }: { etiqueta: string; fecha: Date | null }) {
  const v = vencimiento(fecha);
  const tono = v.nivel === "critico" ? "critico" : v.nivel === "aviso" ? "aviso" : "ok";
  return (
    <Estado tono={tono}>
      {etiqueta}: {v.nivel === "ok" ? "al día" : v.texto.toLowerCase()}
    </Estado>
  );
}

export default async function PaginaFlota({ searchParams }: { searchParams: Promise<{ bajas?: string }> }) {
  const u = await requerirUsuario("flota.ver");
  const { bajas } = await searchParams;
  const editar = puede(u.rol, "flota.editar");
  const verCosto = puede(u.rol, "costos.ver");
  const vehiculos = await db.vehiculo.findMany({
    where: { activo: !bajas },
    orderBy: [{ tipo: "asc" }, { capacidadKg: "desc" }, { nombre: "asc" }],
    include: {
      asignadoA: { select: { nombre: true } },
      viajes: { where: { estado: "EN_VIAJE" }, take: 1, select: { chofer: { select: { nombre: true } }, obra: { select: { nombre: true } } } },
    },
  });
  const grupos = (["CAMION", "CAMIONETA", "AUTO"] as const).map((t) => ({ tipo: t, lista: vehiculos.filter((v) => v.tipo === t) })).filter((g) => g.lista.length);

  return (
    <div>
      <Titulo
        detalle={bajas ? "Vehículos dados de baja" : `${vehiculos.length} vehículos activos`}
        accion={
          editar && !bajas ? (
            <ConPanel titulo="Agregar vehículo" etiqueta="Agregar" icono={<Plus className="size-5" />}>
              <FormularioVehiculo inicial={VEHICULO_VACIO} {...await opcionesFormularioVehiculo()} />
            </ConPanel>
          ) : undefined
        }
      >
        Flota
      </Titulo>

      {vehiculos.length === 0 && <Vacio titulo="No hay vehículos" icono={<Truck className="size-8" />} />}

      {grupos.map((g) => (
        <section key={g.tipo}>
          <Subtitulo>{TIPO_VEHICULO[g.tipo]}{g.lista.length > 1 ? (g.tipo === "CAMION" ? "es" : "s") : ""}</Subtitulo>
          <ul className="flex flex-col gap-2 lg:hidden">
            {g.lista.map((v) => (
              <li key={v.id}>
                <Link href={`/flota/${v.id}`} className="block rounded-[var(--radius-caja)] border border-linea bg-papel p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-lg font-bold">{v.nombre}</p>
                      <p className="text-sm text-suave">
                        {v.patente} · {peso(v.capacidadKg)} · {km(v.kmActual)}
                      </p>
                    </div>
                    {v.viajes[0] ? <Estado tono="activo">En viaje</Estado> : !v.disponibleParaPedidos ? <Estado tono="neutro">Fuera de la cola</Estado> : null}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Documento etiqueta="Seguro" fecha={v.seguroVence} />
                    <Documento etiqueta="VTV" fecha={v.vtvVence} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <Tabla className="hidden lg:block">
            <thead>
              <tr>
                <th>Vehículo</th>
                <th>Patente</th>
                <th>Carga</th>
                <th className="text-right">Km</th>
                {verCosto && <th className="text-right">Costo/km</th>}
                <th>Asignado</th>
                <th>Seguro</th>
                <th>VTV</th>
                <th>Ahora</th>
              </tr>
            </thead>
            <tbody>
              {g.lista.map((v) => (
                <tr key={v.id}>
                  <td className="font-semibold">
                    <Link href={`/flota/${v.id}`} className="hover:underline">
                      {v.nombre}
                    </Link>
                  </td>
                  <td className="tabular-nums">{v.patente}</td>
                  <td>{peso(v.capacidadKg)}</td>
                  <td className="text-right tabular-nums">{km(v.kmActual)}</td>
                  {verCosto && <td className="text-right tabular-nums">{plata(Number(v.costoKm))}</td>}
                  <td>{v.asignadoA?.nombre ?? <span className="text-suave">General</span>}</td>
                  <td>
                    <Documento etiqueta="Seguro" fecha={v.seguroVence} />
                  </td>
                  <td>
                    <Documento etiqueta="VTV" fecha={v.vtvVence} />
                  </td>
                  <td>
                    {v.viajes[0] ? (
                      <Estado tono="activo">
                        {v.viajes[0].chofer.nombre} → {v.viajes[0].obra.nombre}
                      </Estado>
                    ) : v.disponibleParaPedidos ? (
                      <Estado tono="ok">Disponible</Estado>
                    ) : (
                      <Estado tono="neutro">Fuera de la cola</Estado>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        </section>
      ))}

      {editar && (
        <p className="mt-6 text-sm">
          <Link href={bajas ? "/flota" : "/flota?bajas=1"} className="font-semibold underline">
            {bajas ? "Ver vehículos activos" : "Ver dados de baja"}
          </Link>
        </p>
      )}
    </div>
  );
}
