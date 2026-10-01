import Link from "next/link";
import type { Metadata } from "next";
import { startOfMonth } from "date-fns";
import { AlertTriangle, ArrowRight, PlusCircle, ScanLine, Flag, Play, ListOrdered, Download } from "lucide-react";
import { requerirUsuario, type UsuarioActual } from "@/lib/auth/usuario-actual";
import { db } from "@/lib/db";
import { obtenerCola, pedidosDe, viajeEnCursoDe } from "@/lib/datos/pedidos";
import { idsObrasDe } from "@/lib/datos/obras";
import { solicitudes } from "@/lib/datos/deposito";
import { datosMapa } from "@/lib/datos/mapa";
import { alertasPara } from "@/lib/datos/alertas";
import { licenciaVencida } from "@/lib/acciones/comun";
import { BotonLink } from "@/components/ui/boton";
import { Cifra, Subtitulo, Tarjeta, Titulo, Vacio } from "@/components/ui/basicos";
import { TarjetaPedido } from "@/components/pedidos/tarjeta-pedido";
import { BotonTomar } from "@/components/pedidos/acciones-pedido";
import { SolicitudDeposito } from "@/components/deposito/solicitudes";
import { MapaEnVivo } from "@/components/mapa/mapa-en-vivo";
import { ListaAlertas } from "@/components/inicio/lista-alertas";
import { plata, km, fecha } from "@/lib/formato";

export const metadata: Metadata = { title: "Inicio" };

export default async function Inicio() {
  const u = await requerirUsuario();
  switch (u.rol) {
    case "CHOFER":
      return <InicioChofer u={u} />;
    case "RESPONSABLE_OBRA":
    case "CAPATAZ":
      return <InicioObra u={u} />;
    case "DEPOSITO":
      return <InicioDeposito />;
    case "DIRECCION":
      return <InicioDireccion u={u} />;
    case "ADMINISTRACION":
      return <InicioAdministracion u={u} />;
  }
}

// ───────────────────────────── Chofer ─────────────────────────────

async function InicioChofer({ u }: { u: UsuarioActual }) {
  const [enCurso, cola, yo] = await Promise.all([
    viajeEnCursoDe(u.id),
    obtenerCola(),
    db.usuario.findUniqueOrThrow({ where: { id: u.id }, select: { licenciaVence: true } }),
  ]);
  const misTomados = cola.tomados.filter((p) => p.choferId === u.id);
  const otros = [...cola.enViaje, ...cola.tomados].filter((p) => p.choferId !== u.id);

  return (
    <div className="mx-auto max-w-2xl">
      {licenciaVencida(yo.licenciaVence) && (
        <div role="alert" className="mb-4 flex gap-3 rounded-[var(--radius-caja)] border-2 border-critico bg-critico-fondo p-4 text-critico">
          <AlertTriangle className="size-6 shrink-0" />
          <p className="font-semibold">
            {yo.licenciaVence ? `Tu licencia venció el ${fecha(yo.licenciaVence)}.` : "No tenemos cargada tu licencia."} No podés tomar viajes hasta actualizarla en la oficina.
          </p>
        </div>
      )}

      {enCurso && (
        <Link href={`/pedidos/${enCurso.id}`} className="mb-5 block rounded-[var(--radius-caja)] bg-negro p-5 text-white">
          <p className="text-sm font-semibold uppercase tracking-wider text-white/60">Estás en viaje</p>
          <p className="mt-1 text-2xl font-bold">Obra {enCurso.obra.nombre}</p>
          <p className="text-white/75">
            {enCurso.vehiculo?.nombre} · saliste con {km(enCurso.viaje?.kmSalida)}
          </p>
          <span className="mt-4 flex min-h-[56px] items-center justify-center gap-2 rounded-[var(--radius-caja)] bg-white text-lg font-bold text-negro">
            <Flag className="size-5" /> Marcar llegada
          </span>
        </Link>
      )}

      {misTomados.length > 0 && (
        <>
          <Subtitulo>Tomados por vos</Subtitulo>
          <ul className="flex flex-col gap-3">
            {misTomados.map((p) => (
              <TarjetaPedido
                key={p.id}
                p={p}
                accion={
                  <BotonLink href={`/pedidos/${p.id}`} ancho icono={<Play className="size-5" />}>
                    Salir con este pedido
                  </BotonLink>
                }
              />
            ))}
          </ul>
        </>
      )}

      <Titulo detalle={cola.pendientes.length ? "En orden: primero los urgentes, después por hora de pedido." : undefined}>
        <span className="mt-6 block">Pedidos para tomar {cola.pendientes.length > 0 && <span className="text-suave">({cola.pendientes.length})</span>}</span>
      </Titulo>
      {cola.pendientes.length === 0 ? (
        <Vacio titulo="No hay pedidos esperando" icono={<ListOrdered className="size-8" />}>
          Cuando alguien pida un viaje, aparece acá.
        </Vacio>
      ) : (
        <ul className="flex flex-col gap-3">
          {cola.pendientes.map((p, i) => (
            <TarjetaPedido key={p.id} p={p} posicion={i + 1} accion={enCurso ? undefined : <BotonTomar pedidoId={p.id} />} />
          ))}
        </ul>
      )}

      {otros.length > 0 && (
        <>
          <Subtitulo>Lo que están haciendo los demás</Subtitulo>
          <ul className="flex flex-col gap-3">
            {otros.map((p) => (
              <TarjetaPedido key={p.id} p={p} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

// ───────────────────── Responsable de obra / Capataz ─────────────────────

async function InicioObra({ u }: { u: UsuarioActual }) {
  const obraIds = await idsObrasDe(u);
  const [mios, cola, solicitudesPendientes] = await Promise.all([
    pedidosDe(u.id),
    obtenerCola({ obraIds }),
    db.solicitudHerramienta.count({ where: { solicitanteId: u.id, estado: "PENDIENTE" } }),
  ]);
  const activos = mios.filter((p) => ["PENDIENTE", "TOMADO", "EN_VIAJE"].includes(p.estado));
  const recientes = mios.filter((p) => !["PENDIENTE", "TOMADO", "EN_VIAJE"].includes(p.estado));

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-bold">Hola, {u.nombre}</h1>
      <p className="mb-4 text-suave">
        En la cola hay {cola.pendientes.length} {cola.pendientes.length === 1 ? "pedido esperando" : "pedidos esperando"} y {cola.enViaje.length} en viaje
        {u.rol === "RESPONSABLE_OBRA" ? " para tus obras" : ""}.
      </p>

      <BotonLink href="/pedidos/nuevo" ancho tamano="grande" icono={<PlusCircle className="size-6" />} className="text-xl">
        Pedir un viaje
      </BotonLink>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <BotonLink href="/pedidos" variante="secundario" icono={<ListOrdered className="size-5" />}>
          Ver la cola
        </BotonLink>
        <BotonLink href="/herramientas" variante="secundario">
          Herramientas{solicitudesPendientes ? ` (${solicitudesPendientes})` : ""}
        </BotonLink>
      </div>

      <Subtitulo>Tus pedidos en curso</Subtitulo>
      {activos.length === 0 ? (
        <Vacio titulo="No tenés pedidos en curso">Lo que pidas aparece acá con su estado.</Vacio>
      ) : (
        <ul className="flex flex-col gap-3">
          {activos.map((p) => (
            <TarjetaPedido key={p.id} p={p} />
          ))}
        </ul>
      )}

      {recientes.length > 0 && (
        <>
          <Subtitulo>Últimos dos días</Subtitulo>
          <ul className="flex flex-col gap-3">
            {recientes.map((p) => (
              <TarjetaPedido key={p.id} p={p} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

// ───────────────────────────── Depósito ─────────────────────────────

async function InicioDeposito() {
  const [pendientes, enObras, noOperativos] = await Promise.all([
    solicitudes({ estado: "PENDIENTE" }),
    db.item.count({ where: { activo: true, control: "UNITARIA", obraId: { not: null } } }),
    db.item.count({ where: { activo: true, estado: { not: "OPERATIVO" } } }),
  ]);
  return (
    <div className="mx-auto max-w-2xl">
      <BotonLink href="/deposito/escanear" ancho tamano="grande" icono={<ScanLine className="size-7" />} className="min-h-[120px] text-2xl">
        Escanear
      </BotonLink>
      <p className="mt-2 text-center text-sm text-suave">Apuntá al QR de la máquina o herramienta para entregarla o recibirla.</p>

      <div className="mt-5 grid grid-cols-3 gap-2">
        <Cifra etiqueta="Por resolver" valor={pendientes.length} tono={pendientes.length ? "aviso" : undefined} />
        <Cifra etiqueta="Máquinas en obra" valor={enObras} />
        <Cifra etiqueta="En reparación" valor={noOperativos} tono={noOperativos ? "aviso" : undefined} />
      </div>

      <Subtitulo accion={<Link href="/deposito/solicitudes" className="text-sm font-semibold underline">Ver todas</Link>}>Pedidos y devoluciones de obra</Subtitulo>
      {pendientes.length === 0 ? (
        <Vacio titulo="Nada pendiente">Cuando una obra pida o devuelva algo, aparece acá.</Vacio>
      ) : (
        <ul className="flex flex-col gap-3">
          {pendientes.map((s) => (
            <SolicitudDeposito key={s.id} s={s} />
          ))}
        </ul>
      )}
    </div>
  );
}

// ───────────────────────────── Dirección ─────────────────────────────

async function InicioDireccion({ u }: { u: UsuarioActual }) {
  const [mapa, cola, alertas, mes] = await Promise.all([
    datosMapa(),
    obtenerCola(),
    alertasPara(u),
    db.viaje.aggregate({ where: { estado: "FINALIZADO", llegadaEn: { gte: startOfMonth(new Date()) } }, _sum: { costo: true }, _count: { _all: true } }),
  ]);
  const criticas = alertas.activas.filter((a) => a.severidad === "CRITICO").length;
  return (
    <div>
      <Titulo
        accion={
          <BotonLink href="/pedidos/nuevo" variante="secundario" icono={<PlusCircle className="size-5" />} className="hidden lg:inline-flex">
            Pedir un viaje
          </BotonLink>
        }
      >
        Mapa
      </Titulo>
      <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3">
        <Link href="/pedidos"><Cifra etiqueta="Esperando chofer" valor={cola.pendientes.length} tono={cola.pendientes.length > 3 ? "aviso" : undefined} /></Link>
        <Link href="/pedidos"><Cifra etiqueta="En viaje" valor={cola.enViaje.length} detalle={`${cola.tomados.length} tomados`} /></Link>
        <Link href="/alertas"><Cifra etiqueta="Alertas críticas" valor={criticas} tono={criticas ? "critico" : "ok"} /></Link>
        <Link href="/costos"><Cifra etiqueta="Viajes del mes" valor={plata(Number(mes._sum.costo ?? 0))} detalle={`${mes._count._all} viajes`} /></Link>
      </div>
      <MapaEnVivo inicial={mapa} alto="h-[55dvh] lg:h-[calc(100dvh-16rem)]" />
    </div>
  );
}

// ─────────────────────────── Administración ───────────────────────────

async function InicioAdministracion({ u }: { u: UsuarioActual }) {
  const desde = startOfMonth(new Date());
  const [alertas, viajes, combustible, mant, vehiculos] = await Promise.all([
    alertasPara(u),
    db.viaje.aggregate({ where: { estado: "FINALIZADO", llegadaEn: { gte: desde } }, _sum: { costo: true, kmRecorridos: true }, _count: { _all: true } }),
    db.cargaCombustible.aggregate({ where: { fecha: { gte: desde } }, _sum: { monto: true, litros: true } }),
    db.mantenimiento.aggregate({ where: { fecha: { gte: desde } }, _sum: { costo: true } }),
    db.vehiculo.count({ where: { activo: true } }),
  ]);
  const flota = alertas.activas.filter((a) => a.area === "FLOTA" || a.area === "PERSONAS");
  return (
    <div>
      <Titulo
        detalle="Este mes"
        accion={
          <BotonLink href="/costos" variante="secundario" icono={<Download className="size-5" />}>
            Costos y exportar
          </BotonLink>
        }
      >
        Resumen
      </Titulo>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3">
        <Cifra etiqueta="Viajes" valor={plata(Number(viajes._sum.costo ?? 0))} detalle={`${viajes._count._all} viajes · ${km(viajes._sum.kmRecorridos ?? 0)}`} />
        <Cifra etiqueta="Combustible" valor={plata(Number(combustible._sum.monto ?? 0))} detalle={`${Math.round(Number(combustible._sum.litros ?? 0))} litros`} />
        <Cifra etiqueta="Mantenimiento" valor={plata(Number(mant._sum.costo ?? 0))} />
        <Cifra etiqueta="Vehículos activos" valor={vehiculos} />
      </div>
      <Subtitulo accion={<Link href="/alertas" className="flex items-center gap-1 text-sm font-semibold underline">Todas <ArrowRight className="size-4" /></Link>}>
        Documentación y vencimientos
      </Subtitulo>
      {flota.length === 0 ? (
        <Tarjeta className="p-4 font-medium text-ok">Todo en regla.</Tarjeta>
      ) : (
        <ListaAlertas alertas={flota.slice(0, 8)} />
      )}
    </div>
  );
}
