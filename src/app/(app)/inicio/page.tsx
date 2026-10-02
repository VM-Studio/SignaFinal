import type { Metadata } from "next";
import Link from "next/link";
import { Download, ListOrdered, PlusCircle, ScanLine } from "lucide-react";
import { exigirSesion, type UsuarioSesion } from "@/lib/auth/sesion";
import { devolucionesVencidas, misPedidos, pedidosPendientes, resumenDireccion, vencimientosProximos } from "@/lib/datos/inicio";
import { misViajes } from "@/lib/viajes/consultas";
import { deMisObras, enReparacion, paraEntregar } from "@/lib/herramientas/consultas";
import { costosPorObra, costosPorVehiculo, periodo } from "@/lib/costos/consultas";
import { datosMapa } from "@/lib/mapa/consultas";
import { TarjetaViaje } from "@/components/viajes/tarjeta-viaje";
import { MapaEnVivo } from "@/components/mapa/mapa-en-vivo";
import { BotonLink } from "@/components/ui/boton";
import { Cifra, FilaLista, Insignia, Lista, Subtitulo, Vacio } from "@/components/ui/basicos";
import { DOCUMENTO, ESTADO_PEDIDO, textoEstadoPedido } from "@/lib/etiquetas";
import { cuando, fecha, km, plata, vencimiento } from "@/lib/formato";

export const metadata: Metadata = { title: "Inicio" };

export default async function Inicio({ searchParams }: { searchParams: Promise<{ "sin-permiso"?: string }> }) {
  const u = await exigirSesion();
  const sinPermiso = (await searchParams)["sin-permiso"];
  return (
    <div className="mx-auto max-w-3xl lg:max-w-none">
      {sinPermiso && (
        <p role="alert" className="mb-4 rounded-[var(--radius-caja)] border-2 border-aviso bg-aviso-fondo px-4 py-3 font-medium text-aviso">
          Esa sección no está habilitada para tu rol.
        </p>
      )}
      <h1 className="mb-4 text-2xl font-bold lg:text-3xl">Hola, {u.nombre}</h1>
      {u.rol === "CHOFER" && <InicioChofer />}
      {(u.rol === "RESPONSABLE_OBRA" || u.rol === "CAPATAZ") && <InicioObra u={u} />}
      {u.rol === "DEPOSITO" && <InicioDeposito />}
      {u.rol === "DIRECCION" && <InicioDireccion />}
      {u.rol === "ADMINISTRACION" && <InicioAdministracion />}
    </div>
  );
}

// ───────────────────────────── Chofer ─────────────────────────────

async function InicioChofer() {
  const [pendientes, viajes] = await Promise.all([pedidosPendientes(), misViajes()]);
  const enCurso = viajes.find((v) => v.estado === "EN_CURSO");
  const programados = viajes.filter((v) => v.estado === "PROGRAMADO");
  const terminados = viajes.filter((v) => v.estado === "FINALIZADO");
  return (
    <div className="lg:max-w-2xl">
      <BotonLink href="/pedidos" ancho tamano="grande" icono={<ListOrdered className="size-6" />} className="min-h-[88px] text-xl">
        Ver pedidos para tomar
        <span className="ml-1 rounded-full bg-white px-2.5 py-0.5 text-lg text-negro tabular-nums">{pendientes}</span>
      </BotonLink>

      <Subtitulo>Mi viaje en curso</Subtitulo>
      {enCurso ? (
        <ul><TarjetaViaje v={enCurso} puedeIniciar={false} /></ul>
      ) : (
        <Vacio titulo="No tenés un viaje en curso">{programados.length ? "Cuando salgas con el próximo, lo vas a ver acá." : "Tomá un pedido de la cola para empezar."}</Vacio>
      )}

      {programados.length > 0 && (
        <>
          <Subtitulo accion={<Link href="/viajes" className="text-sm font-semibold underline">Ver todos</Link>}>Próximo en tu ruta</Subtitulo>
          <ul><TarjetaViaje v={programados[0]} puedeIniciar={!enCurso} bloqueadoPor={enCurso?.pedidoId} /></ul>
          {programados.length > 1 && <p className="mt-2 text-sm text-suave">Y {programados.length - 1} más programado{programados.length > 2 ? "s" : ""}.</p>}
        </>
      )}
      {terminados.length > 0 && (
        <p className="mt-6 text-suave">
          Hoy terminaste {terminados.length} viaje{terminados.length === 1 ? "" : "s"} · {km(terminados.reduce((a, v) => a + (v.kmLlegada ?? 0) - (v.kmSalida ?? 0), 0))}.
        </p>
      )}
    </div>
  );
}

// ───────────────────── Responsable de obra / Capataz ─────────────────────

async function InicioObra({ u }: { u: UsuarioSesion }) {
  const [pedidos, obra] = await Promise.all([misPedidos(), deMisObras(u)]);
  const vencidas = obra.unitarias.filter((h) => h.vencida).length;
  return (
    <div className="grid gap-x-8 lg:grid-cols-2 [&>section]:min-w-0">
      <section>
        <BotonLink href="/pedidos/nuevo" ancho tamano="grande" icono={<PlusCircle className="size-6" />} className="min-h-[88px] text-xl">
          Pedir un viaje
        </BotonLink>
        <Subtitulo>Mis pedidos</Subtitulo>
        {pedidos.length === 0 ? (
          <Vacio titulo="No tenés pedidos en curso">Lo que pidas aparece acá con su estado.</Vacio>
        ) : (
          <Lista>
            {pedidos.map((p) => (
              <FilaLista
                key={p.id}
                href={`/pedidos/${p.id}`}
                titulo={`Obra ${p.obra.nombre}`}
                detalle={`${p.descripcion} · para ${cuando(p.paraCuando)}`}
                derecha={
                  <div className="flex flex-col items-end gap-1">
                    <Insignia tono={ESTADO_PEDIDO[p.estado].tono}>{textoEstadoPedido(p.estado, p.tomadoPor?.nombre)}</Insignia>
                    {p.prioridad === "URGENTE" && p.estado === "PENDIENTE" && <Insignia tono="critico">Urgente</Insignia>}
                  </div>
                }
              />
            ))}
          </Lista>
        )}
      </section>
      <section>
        <Subtitulo accion={<Link href="/herramientas" className="text-sm font-semibold underline">Pedir una herramienta</Link>}>
          Herramientas en {u.rol === "RESPONSABLE_OBRA" ? "tus obras" : "obra"}{vencidas ? ` · ${vencidas} vencida${vencidas === 1 ? "" : "s"}` : ""}
        </Subtitulo>
        {obra.unitarias.length + obra.porCantidad.length === 0 ? (
          <Vacio titulo="No hay herramientas del depósito en tus obras" />
        ) : (
          <Lista>
            {obra.unitarias.map((h) => (
              <FilaLista
                key={h.id}
                href={`/herramientas/${h.id}`}
                titulo={h.nombre}
                detalle={`Obra ${h.obra?.nombre}${h.responsable ? ` · la tiene ${h.responsable.nombre}` : ""}${h.devolucionPrevista ? ` · vuelve ${fecha(h.devolucionPrevista)}` : ""}`}
                derecha={h.vencida ? <Insignia tono="critico">Vencida</Insignia> : undefined}
              />
            ))}
            {obra.porCantidad.map((e) => (
              <FilaLista key={e.id} href={`/herramientas/${e.herramienta.id}`} titulo={`${e.cantidad} ${e.herramienta.nombre.toLowerCase()}`} detalle={`Obra ${e.obra?.nombre}`} />
            ))}
          </Lista>
        )}
        {obra.salen.length > 0 && (
          <>
            <Subtitulo>Se llevan de tus obras</Subtitulo>
            <Lista>
              {obra.salen.map((p) => (
                <FilaLista key={p.id} href={`/pedidos/${p.id}`} titulo={`${p.herramienta?.nombre} → Obra ${p.obra.nombre}`} detalle={`La pidió ${p.solicitante.nombre} · ${textoEstadoPedido(p.estado)}`} />
              ))}
            </Lista>
          </>
        )}
      </section>
    </div>
  );
}

// ───────────────────────────── Depósito ─────────────────────────────

async function InicioDeposito() {
  const [pedidas, vencidas, reparacion] = await Promise.all([paraEntregar(), devolucionesVencidas(), enReparacion()]);
  return (
    <div className="grid gap-x-8 lg:grid-cols-2 [&>section]:min-w-0">
      <section>
        <BotonLink href="/herramientas/escanear" ancho tamano="grande" icono={<ScanLine className="size-7" />} className="min-h-[104px] text-xl">
          Escanear herramienta
        </BotonLink>
        <Subtitulo accion={<Link href="/entregas" className="text-sm font-semibold underline">Ver todo</Link>}>Para entregar</Subtitulo>
        {pedidas.length === 0 ? (
          <Vacio titulo="Nada pedido por ahora" />
        ) : (
          <Lista>
            {pedidas.slice(0, 6).map((p) => (
              <FilaLista key={p.id} href={`/herramientas/${p.herramienta!.id}?accion=entregar`} titulo={`${p.herramienta!.nombre} → Obra ${p.obra.nombre}`} detalle={`para ${cuando(p.paraCuando)} · ${p.tomadoPor ? `la lleva ${p.tomadoPor.nombre}` : "sin chofer todavía"}`} derecha={p.prioridad === "URGENTE" ? <Insignia tono="critico">Urgente</Insignia> : undefined} />
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
        {reparacion.length > 0 && (
          <>
            <Subtitulo>En reparación</Subtitulo>
            <Lista>
              {reparacion.map((h) => <FilaLista key={h.id} href={`/herramientas/${h.id}?accion=volvio`} titulo={h.nombre} detalle={`${h.codigo} · desde ${fecha(h.actualizadoEn)}`} derecha={<Insignia tono="aviso">En el taller</Insignia>} />)}
            </Lista>
          </>
        )}
      </section>
    </div>
  );
}

// ───────────────────────────── Dirección ─────────────────────────────

async function InicioDireccion() {
  const [r, mapa, obras] = await Promise.all([resumenDireccion(), datosMapa(), costosPorObra(periodo())]);
  const total = obras.reduce((a, o) => a + o.total, 0);
  return (
    <div>
      <MapaEnVivo inicial={mapa} compacto />
      <div className="mt-3 grid grid-cols-3 gap-2 lg:gap-3">
        <Link href="/pedidos"><Cifra etiqueta="Pedidos pendientes" valor={r.pendientes} tono={r.pendientes > 3 ? "aviso" : undefined} /></Link>
        <Link href="/flota"><Cifra etiqueta="Vehículos en viaje" valor={r.enViaje} /></Link>
        <Link href="/alertas"><Cifra etiqueta="Alertas críticas" valor={r.criticas} tono={r.criticas ? "critico" : "ok"} /></Link>
      </div>
      <Subtitulo accion={<Link href="/costos" className="text-sm font-semibold underline">Ver costos</Link>}>Este mes · {plata(total)} en obras</Subtitulo>
      {obras.length === 0 ? (
        <Vacio titulo="Todavía sin viajes terminados este mes" />
      ) : (
        <Lista>
          {obras.slice(0, 5).map((o) => (
            <FilaLista key={o.obraId} href="/costos" titulo={`Obra ${o.obra}`} detalle={`${o.viajes} viajes · ${km(o.km)}`} derecha={<span className="font-bold tabular-nums">{plata(o.total)}</span>} />
          ))}
        </Lista>
      )}
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
