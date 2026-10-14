import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EsqueletoLista } from "@/components/ui/esqueletos";
import { Download, ListOrdered, PlusCircle, Warehouse } from "lucide-react";
import { exigirSesion } from "@/lib/auth/sesion";
import { puede } from "@/lib/permisos";
import { CotizacionDolar } from "@/components/compras/cotizacion-dolar";
import { devolucionesVencidas, pedidosPendientes, resumenDireccion, vencimientosProximos } from "@/lib/datos/inicio";
import { viajesAMisObrasHoy, viajesDeHoy } from "@/lib/pedidos/listas";
import { alertasAbiertas } from "@/lib/alertas/consultas";
import { viajesDelChofer } from "@/lib/viajes/chofer";
import { ETAPAS_EN_CURSO } from "@/lib/viajes/etapas";
import { paraEntregar } from "@/lib/herramientas/consultas";
import { accionesDeHoy } from "@/lib/actividad/consultas";
import { costosPorObra, costosPorVehiculo, periodo } from "@/lib/costos/consultas";
import { datosMapa } from "@/lib/mapa/consultas";
import { TarjetaChofer } from "@/components/viajes/tarjeta-chofer";
import { BotonEtapa } from "@/components/viajes/acciones-viaje";
import { ListaViajes } from "@/components/pedidos/lista-pedidos";
import { BotonLink } from "@/components/ui/boton";
import { AccionPrincipal, Cifra, Esqueleto, FilaLista, Insignia, Lista, Llamado, Subtitulo, Titulo, Vacio } from "@/components/ui/basicos";
import { DOCUMENTO } from "@/lib/etiquetas";
import { cuando, fecha, finDelDia, plata, vencimiento } from "@/lib/formato";
import { cuantasParaAprobar, esperandoACompras, listosEnMisObrasDetalle, resumenCompras } from "@/lib/materiales/consultas";
import { ColaMateriales, MisMateriales } from "@/components/materiales/lista-materiales";
import { Map as MapIcon, ShoppingCart, Stamp } from "lucide-react";

export const metadata: Metadata = { title: "Inicio" };

/** Un inicio por rol, cada uno con UNA acción principal grande. */
export default async function Inicio() {
  const u = await exigirSesion();
  return (
    <div>
      <Titulo siempre>Hola, {u.nombre}</Titulo>
      {/* Celular: la cotización del dólar arriba (en escritorio está en el header). */}
      {puede(u.rol, "dolar.ver") && <div className="mb-3 lg:hidden"><CotizacionDolar variante="tarjeta" /></div>}
      {/* El saludo sale al instante; cada bloque llega cuando está listo. */}
      <Suspense fallback={<EsqueletoLista filas={4} />}>
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
  const [enMisObras, listos, esperando] = await Promise.all([viajesAMisObrasHoy(), listosEnMisObrasDetalle(), esperandoACompras()]);
  return (
    <div className="grid gap-x-6 lg:grid-cols-2 [&>section]:min-w-0">
      <section>
        {/* Una acción principal: Pedir (materiales o viaje). */}
        <AccionPrincipal href="/pedir" icono={<PlusCircle />} titulo="Pedir" detalle="Materiales a Compras o un viaje a tu obra." boton="Pedir" />
        <BotonLink href="/pedir-materiales" variante="secundario" ancho icono={<ShoppingCart />} className="mt-2">Pedir materiales a Compras</BotonLink>
        <Subtitulo accion={listos.length ? <Link href="/pedir/retiro" className="text-sm font-medium underline">Pedir el viaje</Link> : undefined}>Listo para retirar</Subtitulo>
        {listos.length === 0 ? (
          <Vacio titulo="Nada listo para retirar">Cuando Compras habilite un material, aparece acá para pedir el viaje.</Vacio>
        ) : (
          <Lista>
            {listos.map((m) => (
              <FilaLista key={m.id} href={`/pedir/retiro?obra=${m.obraId}&material=${m.id}`} titulo={m.descripcion} detalle={`Obra ${m.obra} · en ${m.proveedor}${m.horario ? ` · ${m.horario}` : ""}`} derecha={<span className="text-sm font-medium text-ok">Pedir el viaje</span>} />
            ))}
          </Lista>
        )}
      </section>
      <section>
        <Subtitulo accion={<Link href="/viajes-en-curso" className="text-sm font-medium underline">Ver viajes</Link>}>En camino hoy</Subtitulo>
        {enMisObras.length === 0 ? <Vacio titulo="Ningún viaje hacia tus obras hoy" /> : <ListaViajes filas={enMisObras} base="/viajes-en-curso" />}
        <Subtitulo accion={<Link href="/mis-pedidos?tab=materiales" className="text-sm font-medium underline">Ver todos</Link>}>Esperando a Compras</Subtitulo>
        {esperando.length === 0 ? <Vacio titulo="Nada esperando a Compras" /> : <MisMateriales filas={esperando} />}
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
    <div className="grid gap-x-6 lg:grid-cols-2 [&>*]:min-w-0">
      <section>
      {enCurso ? (
        <>
          <Subtitulo>Mi viaje en curso</Subtitulo>
          <ul>
            <TarjetaChofer t={enCurso} href={`/viaje/${enCurso.pedidoId}`} destacada accion={
              <BotonEtapa etapa={enCurso.etapa!} pedidoId={enCurso.pedidoId} numero={enCurso.numero} vehiculo={enCurso.vehiculo ?? ""} kmActual={enCurso.kmActual} kmSalida={enCurso.kmSalida} obra={enCurso.entregar.nombre} paraCuando={enCurso.fecha} irAlViaje />
            } />
          </ul>
          <BotonLink href="/solicitudes" variante="secundario" ancho className="mt-3">Solicitudes pendientes: {pendientes}</BotonLink>
        </>
      ) : (
        <AccionPrincipal href="/solicitudes" icono={<ListOrdered />} titulo={pendientes === 1 ? "1 solicitud pendiente" : `${pendientes} solicitudes pendientes`} detalle="Aceptá un viaje para empezar." boton="Ver solicitudes" />
      )}
      </section>
      <section>
      <Subtitulo accion={aceptados.length > 2 ? <Link href="/hoy" className="text-sm font-medium underline">Ver todos</Link> : undefined}>Aceptados para hoy</Subtitulo>
      {aceptados.length === 0 ? (
        <Vacio titulo="No tenés viajes aceptados para hoy">Aceptá una solicitud para empezar.</Vacio>
      ) : (
        <ul className="flex flex-col gap-3">
          {aceptados.slice(0, 2).map((t) => <TarjetaChofer key={t.pedidoId} t={t} href={`/viaje/${t.pedidoId}`} />)}
        </ul>
      )}
      </section>
    </div>
  );
}

// ───────────────────────────── Depósito ─────────────────────────────

async function InicioDeposito() {
  const [pedidas, vencidas] = await Promise.all([paraEntregar(), devolucionesVencidas()]);
  const fin = finDelDia().getTime();
  const paraPreparar = pedidas.filter((p) => p.estado === "TOMADO" && p.paraCuando.getTime() <= fin);
  return (
    <div className="grid gap-x-6 lg:grid-cols-2 [&>section]:min-w-0">
      <section>
        <AccionPrincipal href="/herramientas" icono={<Warehouse />} titulo="Depósito" detalle="Maquinaria y herramientas: dónde está cada una, entregar y devolver." boton="Abrir el depósito" />
        <Subtitulo accion={<Link href="/entregas" className="text-sm font-medium underline">Ver todo</Link>}>Para preparar hoy</Subtitulo>
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

async function InicioCompras() {
  const r = await resumenCompras();
  return (
    <div className="grid gap-x-6 lg:grid-cols-2 [&>section]:min-w-0">
      <section>
        <AccionPrincipal href="/compras" icono={<ShoppingCart />} titulo={r.nuevos.length ? `${r.nuevos.length} ${r.nuevos.length === 1 ? "pedido nuevo" : "pedidos nuevos"}` : "Pedidos nuevos"} detalle={r.nuevos.length ? "Tomalos, armá la OC y mandala a aprobación." : "No hay pedidos nuevos sin tomar."} boton="Ver pedidos nuevos" />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link href="/compras/tablero?estado=PEDIR_AUTORIZACION"><Cifra etiqueta="Esperando aprobación" valor={r.esperando} tono={r.esperando ? "aviso" : undefined} /></Link>
          <Link href="/habilitados"><Cifra etiqueta="Listos sin retirar hace más de 3 días" valor={r.sinRetirar} tono={r.sinRetirar ? "critico" : "ok"} /></Link>
        </div>
        <div className="mt-3 hidden lg:block"><CotizacionDolar variante="tarjeta" /></div>
      </section>
      <section>
        <Subtitulo accion={<Link href="/compras" className="text-sm font-medium underline">Ver la cola</Link>}>Demorados</Subtitulo>
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
    </div>
  );
}
