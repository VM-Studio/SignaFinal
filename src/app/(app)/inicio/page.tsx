import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EsqueletoLista } from "@/components/ui/esqueletos";
import { Download, ListOrdered, PlusCircle, ScanLine } from "lucide-react";
import { exigirSesion } from "@/lib/auth/sesion";
import { devolucionesVencidas, pedidosPendientes, resumenDireccion, vencimientosProximos } from "@/lib/datos/inicio";
import { misPedidosDeHoy, viajesAMisObrasHoy } from "@/lib/pedidos/listas";
import { viajesDelChofer } from "@/lib/viajes/chofer";
import { ETAPAS_EN_CURSO } from "@/lib/viajes/etapas";
import { paraEntregar } from "@/lib/herramientas/consultas";
import { accionesDeHoy } from "@/lib/actividad/consultas";
import { costosPorObra, costosPorVehiculo, periodo } from "@/lib/costos/consultas";
import { datosMapa } from "@/lib/mapa/consultas";
import { TarjetaChofer } from "@/components/viajes/tarjeta-chofer";
import { BotonEtapa } from "@/components/viajes/acciones-viaje";
import { MapaEnVivo } from "@/components/mapa/mapa-en-vivo";
import { ListaPedidos, ListaViajes } from "@/components/pedidos/lista-pedidos";
import { BotonLink } from "@/components/ui/boton";
import { Cifra, Esqueleto, FilaLista, Insignia, Lista, Subtitulo, Vacio } from "@/components/ui/basicos";
import { DOCUMENTO } from "@/lib/etiquetas";
import { cuando, fecha, finDelDia, plata, vencimiento } from "@/lib/formato";
import { cuantasParaAprobar, listosEnMisObras, resumenCompras } from "@/lib/materiales/consultas";
import { ColaMateriales } from "@/components/materiales/lista-materiales";
import { PackageOpen, ShoppingCart, Stamp } from "lucide-react";

export const metadata: Metadata = { title: "Inicio" };

/** Un inicio por rol, cada uno con UNA acción principal grande. */
export default async function Inicio() {
  const u = await exigirSesion();
  return (
    <div className="mx-auto max-w-3xl lg:max-w-none">
      <h1 className="mb-4 text-2xl font-bold lg:text-3xl">Hola, {u.nombre}</h1>
      {/* El saludo sale al instante; cada bloque llega cuando está listo. */}
      <Suspense fallback={<EsqueletoLista filas={4} ancho="max-w-none" />}>
        {u.rol === "CHOFER" && <InicioChofer />}
        {(u.rol === "RESPONSABLE_OBRA" || u.rol === "CAPATAZ") && <InicioObra />}
        {u.rol === "DEPOSITO" && <InicioDeposito />}
        {u.rol === "ADMINISTRACION" && <InicioAdministracion />}
        {u.rol === "COMPRAS" && <InicioCompras />}
      </Suspense>
      {u.rol === "DIRECCION" && <InicioDireccion />}
    </div>
  );
}

// ───────────────────── Responsable de obra / Capataz ─────────────────────

async function InicioObra() {
  const [mios, enMisObras, listos] = await Promise.all([misPedidosDeHoy(), viajesAMisObrasHoy(), listosEnMisObras()]);
  return (
    <div className="grid gap-x-8 lg:grid-cols-2 [&>section]:min-w-0">
      <section>
        <BotonLink href="/pedir" ancho tamano="grande" icono={<PlusCircle className="size-6" />} className="min-h-[88px] text-xl">
          Pedir un viaje
        </BotonLink>
        {/* Lo que Compras dejó listo es lo único que le pide una acción. */}
        {listos > 0 && (
          <Link href="/pedir/retiro" className="mt-3 flex min-h-16 items-center gap-3 rounded-[var(--radius-caja)] border-2 border-ok bg-ok-fondo px-4 py-3 font-bold text-ok">
            <PackageOpen className="size-6 shrink-0" />
            <span className="flex-1">{listos === 1 ? "1 material listo para retirar" : `${listos} materiales listos para retirar`}</span>
            <span className="underline">Pedir el viaje</span>
          </Link>
        )}
        <Link href="/pedir-materiales" className="mt-2 flex min-h-[52px] items-center justify-center gap-2 rounded-[var(--radius-caja)] border-2 border-negro bg-papel font-semibold">
          <ShoppingCart className="size-5" /> Pedir materiales a Compras
        </Link>
        <Subtitulo accion={<Link href="/mis-pedidos" className="text-sm font-semibold underline">Ver todos</Link>}>Mis pedidos de hoy</Subtitulo>
        {mios.length === 0 ? <Vacio titulo="No pediste nada para hoy">Lo que pidas aparece acá con su estado.</Vacio> : <ListaPedidos filas={mios} base="/mis-pedidos" />}
      </section>
      <section>
        <Subtitulo accion={<Link href="/viajes-en-curso" className="text-sm font-semibold underline">Ver viajes</Link>}>En mis obras hoy</Subtitulo>
        {enMisObras.length === 0 ? (
          <Vacio titulo="Ningún viaje aceptado hacia tus obras hoy" />
        ) : (
          <ListaViajes filas={enMisObras} base="/viajes-en-curso" />
        )}
      </section>
    </div>
  );
}

// ───────────────────────────── Chofer ─────────────────────────────

async function InicioChofer() {
  const [pendientes, { tarjetas }] = await Promise.all([pedidosPendientes(), viajesDelChofer("hoy")]);
  const enCurso = tarjetas.find((t) => t.etapa && ETAPAS_EN_CURSO.includes(t.etapa));
  const aceptados = tarjetas.filter((t) => t !== enCurso);
  return (
    <div className="lg:max-w-xl">
      {enCurso ? (
        <>
          <Subtitulo>Mi viaje en curso</Subtitulo>
          <ul>
            <TarjetaChofer t={enCurso} href={`/viaje/${enCurso.pedidoId}`} destacada accion={
              <BotonEtapa etapa={enCurso.etapa!} pedidoId={enCurso.pedidoId} numero={enCurso.numero} vehiculo={enCurso.vehiculo ?? ""} kmActual={enCurso.kmActual} kmSalida={enCurso.kmSalida} obra={enCurso.entregar.nombre} irAlViaje />
            } />
          </ul>
          <BotonLink href="/solicitudes" variante="secundario" ancho className="mt-4">Solicitudes pendientes: {pendientes}</BotonLink>
        </>
      ) : (
        <BotonLink href="/solicitudes" ancho tamano="grande" icono={<ListOrdered className="size-6" />} className="min-h-[88px] text-xl">
          Solicitudes pendientes: {pendientes}
        </BotonLink>
      )}
      <Subtitulo accion={aceptados.length > 2 ? <Link href="/hoy" className="text-sm font-semibold underline">Ver todos</Link> : undefined}>Aceptados para hoy</Subtitulo>
      {aceptados.length === 0 ? (
        <Vacio titulo="No tenés viajes aceptados para hoy">Aceptá una solicitud para empezar.</Vacio>
      ) : (
        <ul className="flex flex-col gap-3">
          {aceptados.slice(0, 2).map((t) => <TarjetaChofer key={t.pedidoId} t={t} href={`/viaje/${t.pedidoId}`} />)}
        </ul>
      )}
    </div>
  );
}

// ───────────────────────────── Depósito ─────────────────────────────

async function InicioDeposito() {
  const [pedidas, vencidas] = await Promise.all([paraEntregar(), devolucionesVencidas()]);
  const fin = finDelDia().getTime();
  const paraPreparar = pedidas.filter((p) => p.estado === "TOMADO" && p.paraCuando.getTime() <= fin);
  return (
    <div className="grid gap-x-8 lg:grid-cols-2 [&>section]:min-w-0">
      <section>
        <BotonLink href="/herramientas/escanear" ancho tamano="grande" icono={<ScanLine className="size-7" />} className="min-h-[104px] text-xl">
          Escanear
        </BotonLink>
        <Subtitulo accion={<Link href="/entregas" className="text-sm font-semibold underline">Ver todo</Link>}>Para preparar hoy</Subtitulo>
        {paraPreparar.length === 0 ? (
          <Vacio titulo="Nada aceptado para hoy">Cuando un chofer acepte un traslado de herramientas, aparece acá para prepararlo.</Vacio>
        ) : (
          <Lista>
            {paraPreparar.map((p) => (
              <FilaLista
                key={p.id}
                href={`/herramientas/${p.herramienta!.id}?accion=entregar`}
                titulo={`${p.herramienta!.nombre} → Obra ${p.obra.nombre}`}
                detalle={`para ${cuando(p.paraCuando)} · la lleva ${p.tomadoPor?.nombre ?? "un chofer"}`}
                derecha={p.prioridad === "URGENTE" ? <Insignia tono="critico">Urgente</Insignia> : undefined}
              />
            ))}
          </Lista>
        )}
      </section>
      <section>
        <Subtitulo>Devoluciones vencidas</Subtitulo>
        {vencidas.length === 0 ? (
          <Vacio titulo="Ninguna vencida">Todo lo que está en obra está dentro de la fecha de devolución.</Vacio>
        ) : (
          <Lista>
            {vencidas.map((h) => (
              <FilaLista key={h.id} href={`/herramientas/${h.id}`} titulo={h.nombre} detalle={`Obra ${h.obra?.nombre}${h.responsable ? ` · la tiene ${h.responsable.nombre}` : ""}`} derecha={<Insignia tono="critico">{vencimiento(h.devolucionPrevista!).texto.replace("Vencido", "Debía volver")}</Insignia>} />
            ))}
          </Lista>
        )}
      </section>
    </div>
  );
}

// ───────────────────────────── Dirección ─────────────────────────────

function InicioDireccion() {
  return (
    <div>
      <Suspense fallback={null}>
        <AprobacionesPendientes />
      </Suspense>
      <Suspense fallback={<Esqueleto className="h-[340px]" />}>
        <MapaDireccion />
      </Suspense>
      <Suspense fallback={<div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3">{[0, 1, 2, 3].map((i) => <Esqueleto key={i} className="h-24" />)}</div>}>
        <CifrasDireccion />
      </Suspense>
    </div>
  );
}

/** Lo que el dueño tiene que hacer: aprobar órdenes de compra. */
async function AprobacionesPendientes() {
  const n = await cuantasParaAprobar();
  if (!n) return null;
  return (
    <Link href="/aprobaciones" className="mb-3 flex min-h-16 items-center gap-3 rounded-[var(--radius-caja)] border-2 border-aviso bg-aviso-fondo px-4 py-3 font-bold text-aviso">
      <Stamp className="size-6 shrink-0" />
      <span className="flex-1">{n === 1 ? "1 orden de compra espera tu aprobación" : `${n} órdenes de compra esperan tu aprobación`}</span>
      <span className="underline">Aprobar</span>
    </Link>
  );
}

async function MapaDireccion() {
  return <MapaEnVivo inicial={await datosMapa()} compacto />;
}

async function CifrasDireccion() {
  const [r, acciones] = await Promise.all([resumenDireccion(), accionesDeHoy()]);
  return (
    <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3">
      <Link href="/solicitudes"><Cifra etiqueta="Solicitudes pendientes" valor={r.pendientes} tono={r.pendientes > 3 ? "aviso" : undefined} /></Link>
      <Link href="/viajes"><Cifra etiqueta="Viajes en curso" valor={r.enViaje} /></Link>
      <Link href="/alertas"><Cifra etiqueta="Alertas críticas" valor={r.criticas} tono={r.criticas ? "critico" : "ok"} /></Link>
      <Link href="/actividad"><Cifra etiqueta="Acciones de hoy" valor={acciones} /></Link>
    </div>
  );
}

// ───────────────────────────── Compras ─────────────────────────────

async function InicioCompras() {
  const r = await resumenCompras();
  return (
    <div className="grid gap-x-8 lg:grid-cols-2 [&>section]:min-w-0">
      <section>
        <BotonLink href="/compras" ancho tamano="grande" icono={<ShoppingCart className="size-6" />} className="min-h-[88px] text-xl">
          {r.nuevos.length ? `Pedidos nuevos: ${r.nuevos.length}` : "Pedidos de material"}
        </BotonLink>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link href="/compras?p=en-compra"><Cifra etiqueta="En compra" valor={r.enCompra} /></Link>
          <Link href="/compras?p=esperando"><Cifra etiqueta="Esperan al dueño" valor={r.esperando} tono={r.esperando ? "aviso" : undefined} /></Link>
          <Link href="/compras?p=aprobados"><Cifra etiqueta="Aprobados" valor={r.aprobados} detalle="falta el proveedor" /></Link>
          <Link href="/habilitados"><Cifra etiqueta="Sin retirar +3 días" valor={r.sinRetirar} tono={r.sinRetirar ? "critico" : "ok"} /></Link>
        </div>
      </section>
      <section>
        <Subtitulo accion={<Link href="/compras" className="text-sm font-semibold underline">Ver la cola</Link>}>Demorados</Subtitulo>
        {r.demorados.length === 0 ? <Vacio titulo="Nada demorado">Todo está dentro de los tiempos.</Vacio> : <ColaMateriales filas={r.demorados.slice(0, 6)} compacta />}
      </section>
    </div>
  );
}

// ─────────────────────────── Administración ───────────────────────────

async function InicioAdministracion() {
  const p = periodo();
  const [docs, obras, vehiculos] = await Promise.all([vencimientosProximos(), costosPorObra(p), costosPorVehiculo(p)]);
  const total = obras.reduce((a, c) => a + c.total, 0);
  const comb = vehiculos.reduce((a, v) => a + v.combustible, 0);
  const mant = vehiculos.reduce((a, v) => a + v.mantenimiento + v.incidentes, 0);
  return (
    <div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:gap-3">
        <Cifra etiqueta="Gasto en obras (mes)" valor={plata(total)} detalle={`${obras.reduce((a, o) => a + o.viajes, 0)} viajes`} />
        <Cifra etiqueta="Combustible (mes)" valor={plata(comb)} />
        <Cifra etiqueta="Mantenimiento (mes)" valor={plata(mant)} />
      </div>
      <div className="grid gap-x-6 lg:grid-cols-2 [&>section]:min-w-0">
        <section>
          <Subtitulo>Vencimientos próximos</Subtitulo>
          {docs.length === 0 ? (
            <Vacio titulo="Nada vence en los próximos 30 días" />
          ) : (
            <Lista>
              {docs.map((d) => {
                const v = vencimiento(d.vencimiento!);
                return <FilaLista key={d.id} href={`/flota/${d.vehiculo.id}?tab=documentacion`} titulo={`${d.vehiculo.nombre} · ${DOCUMENTO[d.tipo]}`} detalle={fecha(d.vencimiento)} derecha={<Insignia tono={v.tono}>{v.texto}</Insignia>} />;
              })}
            </Lista>
          )}
        </section>
        <section>
          <Subtitulo accion={<Link href="/costos" className="flex items-center gap-1 text-sm font-semibold underline"><Download className="size-4" /> Exportar</Link>}>Costo del mes por obra</Subtitulo>
          {obras.length === 0 ? (
            <Vacio titulo="Sin viajes terminados este mes" />
          ) : (
            <Lista>
              {obras.map((c) => (
                <li key={c.obraId} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold">Obra {c.obra}</span>
                    <span className="font-bold tabular-nums">{plata(c.total)}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-3">
                    <div className="h-1.5 flex-1 rounded-full bg-fondo"><div className="h-full rounded-full bg-negro" style={{ width: `${total ? (c.total / total) * 100 : 0}%` }} /></div>
                    <span className="text-sm text-suave">{c.viajes} viajes{c.combustible ? ` · ${plata(c.combustible)} comb.` : ""}</span>
                  </div>
                </li>
              ))}
            </Lista>
          )}
        </section>
      </div>
    </div>
  );
}
