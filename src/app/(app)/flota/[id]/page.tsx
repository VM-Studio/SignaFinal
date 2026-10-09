import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AlertTriangle, ArrowLeft, FileImage, FilePlus, Pencil, Wrench } from "lucide-react";
import { exigirPermiso } from "@/lib/auth/sesion";
import { enlacePedido, puede } from "@/lib/permisos";
import type { Rol } from "@prisma/client";
import { db } from "@/lib/db";
import { ESTADO_VEHICULO, fichaVehiculo, listarFlota, opcionesVehiculo, type Ficha } from "@/lib/flota/consultas";
import { ListaDetalle } from "@/components/ui/lista-detalle";
import { costosPorVehiculo, periodo } from "@/lib/costos/consultas";
import { Cifra, Insignia, Pestanas, Tarjeta, Vacio } from "@/components/ui/basicos";
import { ConHoja } from "@/components/ui/hoja";
import { CambiarEstado, FormularioDocumento, FormularioIncidente, FormularioMantenimiento, FormularioVehiculo } from "@/components/flota/formularios";
import { BotonResolver } from "@/components/flota/resolver";
import { DOCUMENTO } from "@/lib/etiquetas";
import { cuando, dec, diaISO, fecha, km, litros, peso, plata, vencimiento } from "@/lib/formato";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const v = await db.vehiculo.findUnique({ where: { id: (await params).id }, select: { nombre: true } });
  return { title: v?.nombre ?? "Vehículo" };
}

const PESTANAS = { datos: "Datos", documentacion: "Documentación", viajes: "Viajes", combustible: "Combustible", mantenimiento: "Mantenimiento", incidentes: "Incidentes" } as const;
type Pestana = keyof typeof PESTANAS;
const TIPO = { CAMION: "Camión", CAMIONETA: "Camioneta", AUTO: "Auto", MAQUINA: "Máquina" } as const;
const MANT = { SERVICE: "Service", REPARACION: "Reparación", NEUMATICOS: "Neumáticos", OTRO: "Otro" } as const;
const INC = { MULTA: "Multa", SINIESTRO: "Siniestro", ROTURA: "Rotura", ROBO: "Robo" } as const;

export default async function FichaVehiculo({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const u = await exigirPermiso("flota.ver");
  const { id } = await params;
  const t = (await searchParams).tab;
  const tab: Pestana = t && t in PESTANAS ? (t as Pestana) : "datos";
  const [v, flota] = await Promise.all([fichaVehiculo(id), listarFlota()]);
  if (!v) notFound();

  const verCostos = puede(u.rol, "costos.ver");
  const [mes] = verCostos ? await costosPorVehiculo(periodo(), id) : [null];
  const editar = puede(u.rol, "flota.editar");
  const docVencida = v.vigentes.some((d) => d.vencimiento && diaISO(d.vencimiento) < diaISO() && ["SEGURO", "VTV", "RUTA"].includes(d.tipo));

  return (
    <ListaDetalle
      titulo="Flota"
      verTodo="/flota"
      activo={v.id}
      items={flota.vehiculos.map((x) => ({
        id: x.id,
        href: `/flota/${x.id}`,
        titulo: x.nombre,
        detalle: `${TIPO[x.tipo]} · ${x.patente}`,
        derecha: <Insignia tono={ESTADO_VEHICULO[x.estado].tono}>{ESTADO_VEHICULO[x.estado].texto}</Insignia>,
      }))}
    >
    <div>
      <Link href="/flota" className="mb-2 hidden min-h-8 items-center gap-1 text-sm font-medium text-suave hover:text-tinta lg:inline-flex"><ArrowLeft className="size-4" /> Flota</Link>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="etiqueta">{TIPO[v.tipo]} · {v.patente}</p>
          <h1 className="mt-1 text-[22px] leading-7 font-semibold">{v.nombre}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <Insignia tono={ESTADO_VEHICULO[v.estado].tono}>{ESTADO_VEHICULO[v.estado].texto}</Insignia>
            {v.asignadoA && <Insignia tono="neutro">Asignada a {v.asignadoA.nombre}</Insignia>}
            {!v.entraEnCola && <Insignia tono="neutro">No entra en la cola</Insignia>}
            {docVencida && <Insignia tono="critico">Documentación vencida</Insignia>}
          </div>
        </div>
        {editar && (
          <ConHoja titulo={`Editar ${v.nombre}`} etiqueta="Editar" variante="secundario" icono={<Pencil />}>
            <FormularioVehiculo
              inicial={{
                id: v.id, nombre: v.nombre, tipo: v.tipo, patente: v.patente, marca: v.marca, modelo: v.modelo, anio: String(v.anio),
                capacidadCargaKg: String(v.capacidadCargaKg), kmActual: String(v.kmActual), horasMotor: v.horasMotor ? String(v.horasMotor) : "",
                costoKm: String(v.costoKm), entraEnCola: v.entraEnCola, asignadoAId: v.asignadoA?.id ?? "", baseId: v.base?.id ?? "", idCusat: v.idCusat ?? "",
              }}
              {...await opcionesVehiculo()}
            />
          </ConHoja>
        )}
      </div>

      {mes && (
        <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3">
          <Cifra etiqueta="Costo del mes" valor={plata(mes.costoReal)} detalle="Combustible + mantenimiento + incidentes" />
          <Cifra etiqueta="Costo real por km" valor={mes.costoPorKm != null ? plata(mes.costoPorKm) : "—"} detalle={`Tarifa cargada: ${plata(v.costoKm)}/km`} />
          <Cifra etiqueta="Km del mes" valor={km(mes.km)} detalle={`${mes.viajes} viajes`} />
          <Cifra etiqueta="Combustible del mes" valor={plata(mes.combustible)} detalle={litros(mes.litros)} />
        </div>
      )}

      <Pestanas items={(Object.keys(PESTANAS) as Pestana[]).map((k) => ({ href: `/flota/${id}${k === "datos" ? "" : `?tab=${k}`}`, etiqueta: PESTANAS[k], activa: k === tab }))} />

      {tab === "datos" && <Datos v={v} editar={editar} />}
      {tab === "documentacion" && <Documentacion v={v} cargar={puede(u.rol, "flota.documentacion")} />}
      {tab === "viajes" && <Viajes v={v} rol={u.rol} />}
      {tab === "combustible" && <Combustible v={v} />}
      {tab === "mantenimiento" && <Mantenimiento v={v} registrar={puede(u.rol, "mantenimiento.registrar")} />}
      {tab === "incidentes" && <Incidentes v={v} registrar={puede(u.rol, "incidentes.registrar")} resolver={editar} />}
    </div>
    </ListaDetalle>
  );
}

function Datos({ v, editar }: { v: Ficha; editar: boolean }) {
  const filas: [string, string][] = [
    ["Marca y modelo", `${v.marca} ${v.modelo} (${v.anio})`],
    ["Km actuales", km(v.kmActual)],
    ...(v.horasMotor ? [["Horas de motor", String(v.horasMotor)] as [string, string]] : []),
    ["Capacidad de carga", peso(v.capacidadCargaKg)],
    ["Costo por km", plata(v.costoKm)],
    ["Duerme en", v.base?.nombre ?? "—"],
    ["Asignada a", v.asignadoA?.nombre ?? "Uso general"],
    ["Cola de pedidos", v.entraEnCola ? "Sí" : "No"],
    ["Rastreo Cusat", v.idCusat ?? "Sin GPS"],
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <Tarjeta className="p-4">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {filas.map(([k, val]) => (
            <div key={k}><dt className="etiqueta">{k}</dt><dd className="mt-0.5 font-medium">{val}</dd></div>
          ))}
        </dl>
      </Tarjeta>
      {editar && (
        <Tarjeta className="p-4">
          <p className="mb-2 font-semibold">Estado</p>
          <CambiarEstado vehiculoId={v.id} estado={v.estado} />
        </Tarjeta>
      )}
    </div>
  );
}

function Documentacion({ v, cargar }: { v: Ficha; cargar: boolean }) {
  const vigentes = new Set(v.vigentes.map((d) => d.id));
  const orden = [...v.documentos].sort((a, b) => Number(vigentes.has(b.id)) - Number(vigentes.has(a.id)));
  return (
    <div>
      {cargar && (
        <div className="mb-3">
          <ConHoja titulo="Cargar documento" etiqueta="Cargar documento" variante="secundario" icono={<FilePlus />}>
            <FormularioDocumento vehiculoId={v.id} />
          </ConHoja>
        </div>
      )}
      {orden.length === 0 ? (
        <Vacio titulo="Sin documentación cargada" />
      ) : (
        <ul className="divide-y divide-linea overflow-hidden rounded-[var(--radius-caja)] border border-linea bg-papel">
          {orden.map((d) => {
            const vigente = vigentes.has(d.id);
            const ven = d.vencimiento ? vencimiento(d.vencimiento) : null;
            const destacar = vigente && ven && ven.dias <= 30;
            return (
              <li key={d.id} className={`flex min-h-14 items-center gap-3 px-4 py-2 lg:min-h-11 ${destacar ? (ven!.tono === "critico" ? "bg-critico-fondo/60" : "bg-aviso-fondo/60") : ""} ${vigente ? "" : "opacity-55"}`}>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{DOCUMENTO[d.tipo]}{!vigente && " (anterior)"}</p>
                  <p className="text-sm text-suave">{d.vencimiento ? `Vence ${fecha(d.vencimiento)}` : "Sin vencimiento"}{d.notas ? ` · ${d.notas}` : ""}</p>
                </div>
                {vigente && ven && <Insignia tono={destacar ? ven.tono : "ok"}>{destacar ? ven.texto : "Al día"}</Insignia>}
                {d.archivoUrl && (
                  <a href={d.archivoUrl} target="_blank" rel="noopener" aria-label="Ver archivo" className="grid size-11 place-items-center rounded-md hover:bg-black/5"><FileImage className="size-5" /></a>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Viajes({ v, rol }: { v: Ficha; rol: Rol }) {
  if (!v.viajes.length) return <Vacio titulo="Sin viajes todavía" />;
  return (
    <ul className="divide-y divide-linea overflow-hidden rounded-[var(--radius-caja)] border border-linea bg-papel">
      {v.viajes.map((x) => (
        <li key={x.id}>
          <Link href={enlacePedido(rol, x.pedido.id) ?? `/flota/${v.id}?tab=viajes`} className="flex min-h-14 items-center gap-3 px-4 py-2 lg:min-h-11 hover:bg-hover">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{x.pedido.descripcion}</p>
              <p className="text-sm text-suave">Obra {x.pedido.obra.nombre} · {x.chofer.nombre} · {cuando(x.llegadaReal ?? x.salidaReal ?? x.salidaEstimada)}</p>
            </div>
            {x.estado === "FINALIZADO" ? (
              <div className="text-right text-sm"><p className="font-semibold tabular-nums">{plata(x.costoCalculado)}</p><p className="text-suave">{km((x.kmLlegada ?? 0) - (x.kmSalida ?? 0))}</p></div>
            ) : (
              <Insignia tono={x.estado === "EN_CURSO" ? "activo" : "aviso"}>{x.estado === "EN_CURSO" ? "En curso" : "Programado"}</Insignia>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Combustible({ v }: { v: Ficha }) {
  return (
    <div>
      <p className="mb-3 text-suave">
        Consumo promedio: <span className="font-semibold text-tinta">{v.consumoPromedio != null ? `${dec(v.consumoPromedio)} l/100 km` : "sin datos suficientes"}</span>{" "}
        (calculado entre cargas, suponiendo tanque lleno).
      </p>
      {!v.cargas.length ? (
        <Vacio titulo="Sin cargas de combustible" />
      ) : (
        <ul className="divide-y divide-linea overflow-hidden rounded-[var(--radius-caja)] border border-linea bg-papel">
          {v.cargas.map((c) => (
            <li key={c.id} className="flex min-h-14 items-center gap-3 px-4 py-2 lg:min-h-11">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{litros(c.litros)} · {plata(c.monto)}</p>
                <p className="text-sm text-suave">{cuando(c.fecha)} · {c.usuario.nombre} · {km(c.km)}{c.obra ? ` · Obra ${c.obra.nombre}` : ""}</p>
              </div>
              {c.consumo != null && <span className="text-sm font-semibold tabular-nums">{dec(c.consumo)} l/100 km</span>}
              {c.comprobanteUrl && <a href={c.comprobanteUrl} target="_blank" rel="noopener" aria-label="Ver ticket" className="grid size-11 place-items-center rounded-md hover:bg-black/5"><FileImage className="size-5" /></a>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Mantenimiento({ v, registrar }: { v: Ficha; registrar: boolean }) {
  const p = v.proximoMantenimiento;
  const atrasado = p && ((p.faltanKm != null && p.faltanKm <= 0) || (p.fecha && diaISO(p.fecha) < diaISO()));
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className={`rounded-[var(--radius-caja)] border px-4 py-3 ${atrasado ? "border-critico/15 bg-critico-fondo" : "border-linea bg-papel"}`}>
          <p className="etiqueta">Próximo mantenimiento</p>
          <p className="font-semibold">
            {!p && "Sin programar"}
            {p?.km != null && `A los ${km(p.km)} (${p.faltanKm! > 0 ? `faltan ${km(p.faltanKm)}` : `pasado por ${km(-p.faltanKm!)}`})`}
            {p?.km != null && p?.fecha && " · "}
            {p?.fecha && `el ${fecha(p.fecha)}`}
          </p>
        </div>
        {registrar && (
          <ConHoja titulo={`Mantenimiento · ${v.nombre}`} etiqueta="Registrar" variante="secundario" icono={<Wrench />}>
            <FormularioMantenimiento vehiculoId={v.id} kmActual={v.kmActual} />
          </ConHoja>
        )}
      </div>
      {!v.mantenimientos.length ? (
        <Vacio titulo="Sin mantenimientos registrados" />
      ) : (
        <ul className="divide-y divide-linea overflow-hidden rounded-[var(--radius-caja)] border border-linea bg-papel">
          {v.mantenimientos.map((m) => (
            <li key={m.id} className="flex min-h-14 items-center gap-3 px-4 py-2 lg:min-h-11">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{MANT[m.tipo]} · {m.descripcion}</p>
                <p className="text-sm text-suave">{fecha(m.fecha)} · {km(m.km)}{m.taller ? ` · ${m.taller}` : ""}</p>
              </div>
              <p className="font-semibold tabular-nums">{plata(m.costo)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Incidentes({ v, registrar, resolver }: { v: Ficha; registrar: boolean; resolver: boolean }) {
  return (
    <div>
      {registrar && (
        <div className="mb-3">
          <ConHoja titulo={`Incidente · ${v.nombre}`} etiqueta="Registrar incidente" variante="secundario" icono={<AlertTriangle />}>
            <FormularioIncidente vehiculoId={v.id} />
          </ConHoja>
        </div>
      )}
      {!v.incidentes.length ? (
        <Vacio titulo="Sin incidentes" />
      ) : (
        <ul className="divide-y divide-linea overflow-hidden rounded-[var(--radius-caja)] border border-linea bg-papel">
          {v.incidentes.map((i) => (
            <li key={i.id} className="flex min-h-14 items-center gap-3 px-4 py-2 lg:min-h-11">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{INC[i.tipo]} · {i.descripcion}</p>
                <p className="text-sm text-suave">{fecha(i.fecha)}{i.usuario ? ` · ${i.usuario.nombre}` : ""}</p>
              </div>
              <p className="font-semibold tabular-nums">{plata(i.monto)}</p>
              {resolver ? <BotonResolver id={i.id} resuelto={i.resuelto} /> : <Insignia tono={i.resuelto ? "ok" : "aviso"}>{i.resuelto ? "Resuelto" : "Abierto"}</Insignia>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
