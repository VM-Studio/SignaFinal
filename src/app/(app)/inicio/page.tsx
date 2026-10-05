import type { Metadata } from "next";
import Link from "next/link";
import { Download, ListOrdered, PlusCircle, ScanLine } from "lucide-react";
import { exigirSesion } from "@/lib/auth/sesion";
import { devolucionesVencidas, pedidosPendientes, resumenDireccion, vencimientosProximos } from "@/lib/datos/inicio";
import { misPedidosDeHoy, viajesAMisObrasHoy } from "@/lib/pedidos/listas";
import { misViajes } from "@/lib/viajes/consultas";
import { paraEntregar } from "@/lib/herramientas/consultas";
import { accionesDeHoy } from "@/lib/actividad/consultas";
import { costosPorObra, costosPorVehiculo, periodo } from "@/lib/costos/consultas";
import { datosMapa } from "@/lib/mapa/consultas";
import { TarjetaViaje } from "@/components/viajes/tarjeta-viaje";
import { MapaEnVivo } from "@/components/mapa/mapa-en-vivo";
import { ListaPedidos } from "@/components/pedidos/lista-pedidos";
import { BotonLink } from "@/components/ui/boton";
import { Cifra, FilaLista, Insignia, Lista, Subtitulo, Vacio } from "@/components/ui/basicos";
import { DOCUMENTO } from "@/lib/etiquetas";
import { cuando, fecha, finDelDia, km, plata, vencimiento } from "@/lib/formato";

export const metadata: Metadata = { title: "Inicio" };

/** Un inicio por rol, cada uno con UNA acción principal grande. */
export default async function Inicio() {
  const u = await exigirSesion();
  return (
    <div className="mx-auto max-w-3xl lg:max-w-none">
      <h1 className="mb-4 text-2xl font-bold lg:text-3xl">Hola, {u.nombre}</h1>
      {u.rol === "CHOFER" && <InicioChofer />}
      {(u.rol === "RESPONSABLE_OBRA" || u.rol === "CAPATAZ") && <InicioObra />}
      {u.rol === "DEPOSITO" && <InicioDeposito />}
      {u.rol === "DIRECCION" && <InicioDireccion />}
      {u.rol === "ADMINISTRACION" && <InicioAdministracion />}
    </div>
  );
}

// ───────────────────── Responsable de obra / Capataz ─────────────────────

async function InicioObra() {
  const [mios, enMisObras] = await Promise.all([misPedidosDeHoy(), viajesAMisObrasHoy()]);
  return (
    <div className="grid gap-x-8 lg:grid-cols-2 [&>section]:min-w-0">
      <section>
        <BotonLink href="/pedir" ancho tamano="grande" icono={<PlusCircle className="size-6" />} className="min-h-[88px] text-xl">
          Pedir un viaje
        </BotonLink>
        <Subtitulo accion={<Link href="/mis-pedidos" className="text-sm font-semibold underline">Ver todos</Link>}>Mis pedidos de hoy</Subtitulo>
        {mios.length === 0 ? <Vacio titulo="No pediste nada para hoy">Lo que pidas aparece acá con su estado.</Vacio> : <ListaPedidos filas={mios} base="/mis-pedidos" />}
      </section>
      <section>
        <Subtitulo accion={<Link href="/viajes-en-curso" className="text-sm font-semibold underline">Ver viajes</Link>}>En mis obras hoy</Subtitulo>
        {enMisObras.length === 0 ? (
          <Vacio titulo="Ningún viaje aceptado hacia tus obras hoy" />
        ) : (
          <ListaPedidos filas={enMisObras} base="/viajes-en-curso" conSolicitante />
        )}
      </section>
    </div>
  );
}

// ───────────────────────────── Chofer ─────────────────────────────

async function InicioChofer() {
  const [pendientes, viajes] = await Promise.all([pedidosPendientes(), misViajes()]);
  const enCurso = viajes.find((v) => v.estado === "EN_CURSO");
  const aceptados = viajes.filter((v) => v.estado === "PROGRAMADO");
  const terminados = viajes.filter((v) => v.estado === "FINALIZADO");
  return (
    <div className="lg:max-w-2xl">
      {enCurso ? (
        <>
          <Subtitulo>Mi viaje en curso</Subtitulo>
          <ul><TarjetaViaje v={enCurso} puedeIniciar={false} /></ul>
          <BotonLink href="/solicitudes" variante="secundario" ancho className="mt-4">Solicitudes pendientes: {pendientes}</BotonLink>
        </>
      ) : (
        <BotonLink href="/solicitudes" ancho tamano="grande" icono={<ListOrdered className="size-6" />} className="min-h-[88px] text-xl">
          Solicitudes pendientes: {pendientes}
        </BotonLink>
      )}
      <Subtitulo accion={aceptados.length > 1 ? <Link href="/hoy" className="text-sm font-semibold underline">Ver todos</Link> : undefined}>Aceptados para hoy</Subtitulo>
      {aceptados.length === 0 ? (
        <Vacio titulo="No tenés viajes aceptados">Aceptá una solicitud para empezar.</Vacio>
      ) : (
        <ul className="flex flex-col gap-3">
          {aceptados.slice(0, 3).map((v) => <TarjetaViaje key={v.viajeId} v={v} puedeIniciar={!enCurso} bloqueadoPor={enCurso?.pedidoId} />)}
        </ul>
      )}
      {terminados.length > 0 && (
        <p className="mt-6 text-suave">
          Hoy terminaste {terminados.length} viaje{terminados.length === 1 ? "" : "s"} · {km(terminados.reduce((a, v) => a + (v.kmLlegada ?? 0) - (v.kmSalida ?? 0), 0))}.
        </p>
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

async function InicioDireccion() {
  const [r, mapa, acciones] = await Promise.all([resumenDireccion(), datosMapa(), accionesDeHoy()]);
  return (
    <div>
      <MapaEnVivo inicial={mapa} compacto />
      <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3">
        <Link href="/solicitudes"><Cifra etiqueta="Solicitudes pendientes" valor={r.pendientes} tono={r.pendientes > 3 ? "aviso" : undefined} /></Link>
        <Link href="/viajes"><Cifra etiqueta="Viajes en curso" valor={r.enViaje} /></Link>
        <Link href="/alertas"><Cifra etiqueta="Alertas críticas" valor={r.criticas} tono={r.criticas ? "critico" : "ok"} /></Link>
        <Link href="/actividad"><Cifra etiqueta="Acciones de hoy" valor={acciones} /></Link>
      </div>
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
      <div className="grid grid-cols-3 gap-2 lg:gap-3">
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
