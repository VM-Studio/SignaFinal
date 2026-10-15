import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { EsqueletoLista } from "@/components/ui/esqueletos";
import { Download, PlusCircle, } from "lucide-react";
import { exigirSesion } from "@/lib/auth/sesion";
import { inicioDe, puede } from "@/lib/permisos";
import { CotizacionDolar } from "@/components/compras/cotizacion-dolar";
import { resumenDireccion, vencimientosProximos } from "@/lib/datos/inicio";
import { viajesAMisObrasHoy, viajesDeHoy } from "@/lib/pedidos/listas";
import { alertasAbiertas } from "@/lib/alertas/consultas";
import { accionesDeHoy } from "@/lib/actividad/consultas";
import { costosPorObra, costosPorVehiculo, periodo } from "@/lib/costos/consultas";
import { datosMapa } from "@/lib/mapa/consultas";
import { ListaViajes } from "@/components/pedidos/lista-pedidos";
import { AccionPrincipal, Cifra, Esqueleto, FilaLista, Insignia, Lista, Llamado, Subtitulo, Titulo, Vacio } from "@/components/ui/basicos";
import { DOCUMENTO } from "@/lib/etiquetas";
import { fecha, plata, vencimiento } from "@/lib/formato";
import { cuantasParaAprobar, esperandoACompras, listosEnMisObrasDetalle, pagosEsperandoAutorizacion, paraFacturar } from "@/lib/materiales/consultas";
import { textosDe } from "@/lib/compras/celdas";
import { nombreDoc } from "@/lib/compras/documento";
import { MisDocumentos, TarjetasListos } from "@/components/materiales/lista-materiales";
import { Map as MapIcon, Stamp } from "lucide-react";

export const metadata: Metadata = { title: "Inicio" };

/** Un inicio por rol, cada uno con UNA acción principal grande. */
export default async function Inicio() {
  const u = await exigirSesion();
  // Compras, el chofer y Depósito no tienen inicio: entran al Tablero, a Hoy y a Herramientas.
  if (inicioDe(u.rol) !== "/inicio") redirect(inicioDe(u.rol));
  return (
    <div>
      <Titulo siempre>Hola, {u.nombre}</Titulo>
      {/* Celular: la cotización del dólar arriba (en escritorio está en el header). */}
      {puede(u.rol, "dolar.ver") && <div className="mb-3 lg:hidden"><CotizacionDolar variante="tarjeta" /></div>}
      {/* El saludo sale al instante; cada bloque llega cuando está listo. */}
      <Suspense fallback={<EsqueletoLista filas={4} />}>
        {(u.rol === "RESPONSABLE_OBRA" || u.rol === "CAPATAZ") && <InicioObra />}
        {u.rol === "ADMINISTRACION" && <InicioAdministracion />}
      </Suspense>
      {u.rol === "DIRECCION" && <InicioDireccion />}
    </div>
  );
}

// ───────────────────── Responsable de obra / Capataz ─────────────────────

async function InicioObra() {
  const [enMisObras, listos, esperando] = await Promise.all([viajesAMisObrasHoy(), listosEnMisObrasDetalle(), esperandoACompras()]);
  return (
    <div className="grid gap-x-6 lg:grid-cols-2 [&>section]:min-w-0">
      <section>
        {/* Una acción principal: Pedir (materiales o viaje). */}
        <AccionPrincipal href="/pedir" icono={<PlusCircle />} titulo="Pedir" detalle="Materiales a Compras o un viaje a tu obra." boton="Pedir" />
        {/* Cada tarjeta verde tiene su "Pedir el viaje" con el material ya marcado. */}
        {listos.length > 0 && (
          <>
            <Subtitulo>Listo para retirar</Subtitulo>
            <TarjetasListos listos={listos} />
          </>
        )}
      </section>
      <section>
        <Subtitulo accion={<Link href="/viajes-en-curso" className="text-sm font-medium underline">Ver viajes</Link>}>En camino hoy</Subtitulo>
        {enMisObras.length === 0 ? <Vacio titulo="Ningún viaje hacia tus obras hoy" /> : <ListaViajes filas={enMisObras} base="/viajes-en-curso" />}
        <Subtitulo accion={<Link href="/mis-pedidos?tab=materiales" className="text-sm font-medium underline">Ver todos</Link>}>Esperando a Compras</Subtitulo>
        {esperando.length === 0 ? <Vacio titulo="Nada esperando a Compras" /> : <MisDocumentos filas={esperando} desde="mis-pedidos" />}
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
      {/* Escritorio: grilla de 12; los viajes de hoy y las alertas en 8, las cifras y el mapa chico en 4. */}
      <div className="grid gap-x-6 gap-y-2 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8">
          <Suspense fallback={<EsqueletoLista filas={4} />}>
            <ViajesDeHoy />
          </Suspense>
          <Suspense fallback={null}>
            <AlertasCriticas />
          </Suspense>
        </div>
        <div className="min-w-0 lg:col-span-4 lg:pt-12">
          <Suspense fallback={<div className="grid grid-cols-2 gap-2 lg:gap-3">{[0, 1, 2, 3].map((i) => <Esqueleto key={i} className="h-24" />)}</div>}>
            <CifrasDireccion />
          </Suspense>
          <Suspense fallback={<Esqueleto className="mt-3 h-40" />}>
            <MapaChico />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

async function ViajesDeHoy() {
  const { filas, total } = await viajesDeHoy(6);
  return (
    <section>
      <Subtitulo accion={<Link href="/solicitudes" className="text-sm font-medium underline">{total > filas.length ? `Ver los ${total}` : "Ver solicitudes"}</Link>}>Viajes de hoy</Subtitulo>
      {filas.length === 0 ? <Vacio titulo="No hay viajes para hoy" /> : <ListaViajes filas={filas} base="/solicitudes" />}
    </section>
  );
}

async function AlertasCriticas() {
  const alertas = (await alertasAbiertas(20)).filter((a) => a.severidad === "CRITICA").slice(0, 5);
  if (!alertas.length) return null;
  return (
    <section>
      <Subtitulo accion={<Link href="/alertas" className="text-sm font-medium underline">Ver alertas</Link>}>Alertas críticas</Subtitulo>
      <Lista>
        {alertas.map((a) => <FilaLista key={a.id} href={a.enlace ?? "/alertas"} titulo={a.titulo} detalle={a.detalle} derecha={<Insignia tono="critico">Crítica</Insignia>} />)}
      </Lista>
    </section>
  );
}

/** El mapa como tarjeta chica (sin cargar Leaflet en el inicio): cuántos en viaje y "Ver mapa". */
async function MapaChico() {
  const d = await datosMapa();
  const enViaje = d.vehiculos.filter((v) => v.estado === "EN_VIAJE").length;
  return (
    <Link href="/mapa" className="mt-3 flex items-center gap-3 rounded-[var(--radius-caja)] border border-linea bg-papel p-4 hover:bg-hover">
      <span className="grid size-10 shrink-0 place-items-center rounded-md bg-fondo"><MapIcon className="size-5 text-suave" strokeWidth={1.75} /></span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">Mapa</span>
        <span className="block text-sm text-suave">{enViaje === 1 ? "1 vehículo en viaje" : `${enViaje} vehículos en viaje`} · {d.vehiculos.length} con GPS</span>
      </span>
      <span className="text-sm font-medium underline">Ver mapa</span>
    </Link>
  );
}

/** Lo que el dueño tiene que hacer: aprobar órdenes de compra. */
async function AprobacionesPendientes() {
  const n = await cuantasParaAprobar();
  if (!n) return null;
  return (
    <div className="mb-3">
      <Llamado href="/aprobaciones" icono={<Stamp />} tono="aviso" enlace="Aprobar">
        {n === 1 ? "1 orden de compra espera tu aprobación" : `${n} órdenes de compra esperan tu aprobación`}
      </Llamado>
    </div>
  );
}

async function CifrasDireccion() {
  const [r, acciones] = await Promise.all([resumenDireccion(), accionesDeHoy()]);
  return (
    <div className="grid grid-cols-2 gap-2 lg:gap-3">
      <Link href="/solicitudes"><Cifra etiqueta="Solicitudes pendientes" valor={r.pendientes} tono={r.pendientes > 3 ? "aviso" : undefined} /></Link>
      <Link href="/viajes"><Cifra etiqueta="Viajes en curso" valor={r.enViaje} /></Link>
      <Link href="/alertas"><Cifra etiqueta="Alertas críticas" valor={r.criticas} tono={r.criticas ? "critico" : "ok"} /></Link>
      <Link href="/actividad"><Cifra etiqueta="Acciones de hoy" valor={acciones} /></Link>
    </div>
  );
}

// ───────────────────────────── Compras ─────────────────────────────

// ─────────────────────────── Administración ───────────────────────────

async function InicioAdministracion() {
  const p = periodo();
  // Primero lo de Camila de todos los días: facturas que faltan cargar y pagos esperando al dueño; después la flota.
  const [facturar, pagos, docs, obras, vehiculos] = await Promise.all([paraFacturar({ obra: [], pendiente: "factura" }, 8), pagosEsperandoAutorizacion(), vencimientosProximos(), costosPorObra(p), costosPorVehiculo(p)]);
  const total = obras.reduce((a, c) => a + c.total, 0);
  const comb = vehiculos.reduce((a, v) => a + v.combustible, 0);
  const mant = vehiculos.reduce((a, v) => a + v.mantenimiento + v.incidentes, 0);
  const filaDoc = (o: (typeof pagos)[number], detalle: string) => {
    const t = textosDe(o);
    return <FilaLista key={o.id} href={`/compras/oc/${o.id}?desde=facturacion`} titulo={`${nombreDoc(o)} · ${t.proveedorFinal || t.obra}`} detalle={detalle} derecha={<span className="font-medium tabular-nums">{t.importe}</span>} />;
  };
  return (
    <div>
      <div className="grid gap-x-6 lg:grid-cols-2 [&>section]:min-w-0">
        <section>
          <Subtitulo accion={facturar.total > facturar.filas.length ? <Link href="/compras/facturacion?p=factura" className="text-sm font-medium underline">Ver las {facturar.total}</Link> : undefined}>OC con facturación pendiente</Subtitulo>
          {facturar.filas.length === 0 ? <Vacio titulo="Ninguna orden espera la factura" /> : <Lista>{facturar.filas.map((o) => filaDoc(o, `Obra ${textosDe(o).obra}`))}</Lista>}
        </section>
        <section>
          <Subtitulo>Pagos a autorizar</Subtitulo>
          {pagos.length === 0 ? <Vacio titulo="Ningún pago espera al dueño" /> : <Lista>{pagos.map((o) => filaDoc(o, `Pedido el ${fecha(o.pagoSolicitadoEn!)}`))}</Lista>}
        </section>
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
          <Subtitulo accion={<Link href="/costos" className="flex items-center gap-1 text-sm font-medium underline"><Download className="size-4" /> Exportar</Link>}>Costo del mes por obra</Subtitulo>
          {obras.length === 0 ? (
            <Vacio titulo="Sin viajes terminados este mes" />
          ) : (
            <Lista>
              {obras.map((c) => (
                <li key={c.obraId} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">Obra {c.obra}</span>
                    <span className="font-medium tabular-nums">{plata(c.total)}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-3">
                    <div className="h-1 flex-1 rounded-full bg-black/[0.06]"><div className="h-full rounded-full bg-tinta" style={{ width: `${total ? (c.total / total) * 100 : 0}%` }} /></div>
                    <span className="text-sm text-suave">{c.viajes} viajes{c.combustible ? ` · ${plata(c.combustible)} comb.` : ""}</span>
                  </div>
                </li>
              ))}
            </Lista>
          )}
        </section>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-3 lg:gap-3">
        <Cifra etiqueta="Gasto en obras (mes)" valor={plata(total)} detalle={`${obras.reduce((a, o) => a + o.viajes, 0)} viajes`} />
        <Cifra etiqueta="Combustible (mes)" valor={plata(comb)} />
        <Cifra etiqueta="Mantenimiento (mes)" valor={plata(mant)} />
      </div>
    </div>
  );
}
