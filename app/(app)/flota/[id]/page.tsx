import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Pencil, Wrench } from "lucide-react";
import { requerirUsuario } from "@/lib/auth/usuario-actual";
import { puede } from "@/lib/permisos";
import { db } from "@/lib/db";
import { cambiarActivoVehiculo } from "@/lib/acciones/flota";
import { opcionesFormularioVehiculo, vehiculoEditable } from "@/lib/datos/flota";
import { Dato, Subtitulo, Tabla, Tarjeta, Vacio } from "@/components/ui/basicos";
import { Estado } from "@/components/ui/estado";
import { ConPanel } from "@/components/ui/panel";
import { FormularioVehiculo } from "@/components/flota/formulario-vehiculo";
import { FormularioMantenimiento } from "@/components/flota/formulario-mantenimiento";
import { BotonActivo } from "@/components/flota/boton-activo";
import { TIPO_MANTENIMIENTO, TIPO_VEHICULO } from "@/lib/etiquetas";
import { cuando, dec, fecha, km, peso, plata, vencimiento } from "@/lib/formato";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const v = await db.vehiculo.findUnique({ where: { id }, select: { nombre: true } });
  return { title: v?.nombre ?? "Vehículo" };
}

function DocCaja({ titulo, vence, detalle }: { titulo: string; vence: Date | null; detalle?: string | null }) {
  const v = vencimiento(vence);
  const tono = v.nivel === "critico" ? "critico" : v.nivel === "aviso" ? "aviso" : "ok";
  return (
    <Tarjeta className="flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-bold">{titulo}</p>
        <Estado tono={tono}>{v.nivel === "critico" ? "Vencido" : v.nivel === "aviso" ? "Por vencer" : "Al día"}</Estado>
      </div>
      <p className="text-suave">{v.texto}</p>
      {detalle && <p className="text-sm text-suave">{detalle}</p>}
    </Tarjeta>
  );
}

export default async function PaginaVehiculo({ params }: { params: Promise<{ id: string }> }) {
  const u = await requerirUsuario("flota.ver");
  const { id } = await params;
  const v = await db.vehiculo.findUnique({
    where: { id },
    include: {
      asignadoA: { select: { nombre: true } },
      lugar: { select: { nombre: true } },
      mantenimientos: { orderBy: { fecha: "desc" }, take: 20 },
      cargas: { orderBy: { fecha: "desc" }, take: 10, include: { chofer: { select: { nombre: true } } } },
      viajes: { orderBy: { salidaEn: "desc" }, take: 10, include: { obra: { select: { nombre: true } }, chofer: { select: { nombre: true } } } },
    },
  });
  if (!v) notFound();
  const editar = puede(u.rol, "flota.editar");
  const mantener = puede(u.rol, "mantenimiento.registrar");
  const verCosto = puede(u.rol, "costos.ver");
  const proximo = v.mantenimientos.find((m) => m.proximoKm || m.proximaFecha);

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/flota" className="mb-3 inline-flex min-h-11 items-center gap-1 font-semibold text-suave">
        <ArrowLeft className="size-5" /> Flota
      </Link>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-suave">
            {TIPO_VEHICULO[v.tipo]} · {v.patente}
          </p>
          <h1 className="text-3xl font-bold tracking-tight">{v.nombre}</h1>
          <p className="text-suave">{[v.marca, v.modelo, v.anio].filter(Boolean).join(" ")}</p>
          {!v.activo && <Estado tono="neutro" className="mt-2">Dado de baja</Estado>}
        </div>
        <div className="flex flex-wrap gap-2">
          {mantener && v.activo && (
            <ConPanel titulo={`Mantenimiento · ${v.nombre}`} etiqueta="Registrar mantenimiento" variante="secundario" icono={<Wrench className="size-5" />}>
              <FormularioMantenimiento vehiculoId={v.id} kmActual={v.kmActual} />
            </ConPanel>
          )}
          {editar && (
            <ConPanel titulo={`Editar · ${v.nombre}`} etiqueta="Editar" variante="secundario" icono={<Pencil className="size-5" />}>
              <FormularioVehiculo inicial={(await vehiculoEditable(v.id))!} {...await opcionesFormularioVehiculo()} />
            </ConPanel>
          )}
        </div>
      </div>

      <Tarjeta className="p-4">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Dato etiqueta="Km">{km(v.kmActual)}</Dato>
          <Dato etiqueta="Carga">{peso(v.capacidadKg)}</Dato>
          {verCosto && <Dato etiqueta="Costo por km">{plata(Number(v.costoKm))}</Dato>}
          <Dato etiqueta="Asignado a">{v.asignadoA?.nombre ?? "Uso general"}</Dato>
          <Dato etiqueta="Se guarda en">{v.lugar?.nombre ?? "—"}</Dato>
          <Dato etiqueta="Cola de pedidos">{v.disponibleParaPedidos ? "Sí" : "No"}</Dato>
        </dl>
        {v.notas && <p className="mt-3 text-suave">{v.notas}</p>}
      </Tarjeta>

      <Subtitulo>Documentación</Subtitulo>
      <div className="grid gap-3 sm:grid-cols-3">
        <DocCaja titulo="Seguro" vence={v.seguroVence} detalle={[v.seguroCompania, v.seguroPoliza && `Póliza ${v.seguroPoliza}`].filter(Boolean).join(" · ")} />
        <DocCaja titulo="VTV" vence={v.vtvVence} />
        <Tarjeta className="flex flex-col gap-2 p-4">
          <p className="font-bold">Próximo mantenimiento</p>
          {proximo ? (
            <p className="text-suave">
              {proximo.proximoKm && `A los ${km(proximo.proximoKm)} (faltan ${km(Math.max(0, proximo.proximoKm - v.kmActual))})`}
              {proximo.proximoKm && proximo.proximaFecha && " · "}
              {proximo.proximaFecha && `El ${fecha(proximo.proximaFecha)}`}
            </p>
          ) : (
            <p className="text-suave">Sin programar</p>
          )}
        </Tarjeta>
      </div>

      <Subtitulo>Mantenimiento</Subtitulo>
      {v.mantenimientos.length === 0 ? (
        <Vacio titulo="Sin mantenimientos registrados" />
      ) : (
        <Tabla>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Detalle</th>
              <th className="hidden sm:table-cell">Km</th>
              <th className="hidden sm:table-cell">Taller</th>
              {verCosto && <th className="text-right">Costo</th>}
            </tr>
          </thead>
          <tbody>
            {v.mantenimientos.map((m) => (
              <tr key={m.id}>
                <td className="whitespace-nowrap">{fecha(m.fecha)}</td>
                <td>{TIPO_MANTENIMIENTO[m.tipo]}</td>
                <td>{m.descripcion}</td>
                <td className="hidden tabular-nums sm:table-cell">{km(m.km)}</td>
                <td className="hidden sm:table-cell">{m.taller ?? "—"}</td>
                {verCosto && <td className="text-right tabular-nums">{plata(Number(m.costo))}</td>}
              </tr>
            ))}
          </tbody>
        </Tabla>
      )}

      <div className="grid gap-x-6 lg:grid-cols-2">
        <section>
          <Subtitulo>Últimos viajes</Subtitulo>
          {v.viajes.length === 0 ? (
            <Vacio titulo="Sin viajes" />
          ) : (
            <Tabla>
              <tbody>
                {v.viajes.map((x) => (
                  <tr key={x.id}>
                    <td className="whitespace-nowrap text-suave">{cuando(x.salidaEn)}</td>
                    <td className="font-medium">
                      <Link href={`/pedidos/${x.pedidoId}`} className="hover:underline">
                        Obra {x.obra.nombre}
                      </Link>
                    </td>
                    <td>{x.chofer.nombre}</td>
                    <td className="text-right tabular-nums">{x.estado === "EN_VIAJE" ? <Estado tono="activo">En viaje</Estado> : km(x.kmRecorridos)}</td>
                  </tr>
                ))}
              </tbody>
            </Tabla>
          )}
        </section>
        <section>
          <Subtitulo>Últimas cargas de combustible</Subtitulo>
          {v.cargas.length === 0 ? (
            <Vacio titulo="Sin cargas" />
          ) : (
            <Tabla>
              <tbody>
                {v.cargas.map((c) => (
                  <tr key={c.id}>
                    <td className="whitespace-nowrap text-suave">{cuando(c.fecha)}</td>
                    <td>{c.chofer.nombre}</td>
                    <td className="text-right tabular-nums">{dec(Number(c.litros))} l</td>
                    <td className="text-right tabular-nums">{plata(Number(c.monto))}</td>
                  </tr>
                ))}
              </tbody>
            </Tabla>
          )}
        </section>
      </div>

      {editar && (
        <div className="mt-8 border-t border-linea pt-4">
          <BotonActivo activo={v.activo} nombre={v.nombre} accion={cambiarActivoVehiculo.bind(null, v.id)} />
        </div>
      )}
    </div>
  );
}
