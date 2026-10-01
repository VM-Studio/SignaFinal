import type { Metadata } from "next";
import { AlertTriangle, Flag, ListOrdered, Map, PlusCircle, ScanLine } from "lucide-react";
import { exigirSesion } from "@/lib/auth/sesion";
import {
  costoDelMesPorObra, devolucionesVencidas, miViajeEnCurso, misPedidos, pedidosPendientes, resumenDireccion, vencimientosProximos,
} from "@/lib/datos/inicio";
import { BotonLink } from "@/components/ui/boton";
import { Cifra, FilaLista, Insignia, Lista, Subtitulo, Tarjeta, Vacio } from "@/components/ui/basicos";
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
      {(u.rol === "RESPONSABLE_OBRA" || u.rol === "CAPATAZ") && <InicioObra />}
      {u.rol === "DEPOSITO" && <InicioDeposito />}
      {u.rol === "DIRECCION" && <InicioDireccion />}
      {u.rol === "ADMINISTRACION" && <InicioAdministracion />}
    </div>
  );
}

// ───────────────────────────── Chofer ─────────────────────────────

async function InicioChofer() {
  const [pendientes, viaje] = await Promise.all([pedidosPendientes(), miViajeEnCurso()]);
  return (
    <div className="lg:max-w-2xl">
      <BotonLink href="/pedidos" ancho tamano="grande" icono={<ListOrdered className="size-6" />} className="min-h-[88px] text-xl">
        Ver pedidos para tomar
        <span className="ml-1 rounded-full bg-white px-2.5 py-0.5 text-lg text-negro tabular-nums">{pendientes}</span>
      </BotonLink>

      <Subtitulo>Mi viaje en curso</Subtitulo>
      {viaje ? (
        <Tarjeta className="p-4">
          <p className="text-xs font-semibold tracking-wider text-suave uppercase">Pedido {viaje.pedido.numero}</p>
          <p className="text-xl font-bold">Obra {viaje.pedido.obra.nombre}</p>
          <p className="text-suave">
            {viaje.pedido.proveedor ? `Desde ${viaje.pedido.proveedor.nombre} · ` : ""}
            {viaje.vehiculo.nombre}
          </p>
          <p className="mt-1 text-sm text-suave">
            Saliste {cuando(viaje.salidaReal)} con {km(viaje.kmSalida)}
          </p>
          <BotonLink href={`/viajes?finalizar=${viaje.id}`} ancho className="mt-4" icono={<Flag className="size-5" />}>
            Finalizar viaje
          </BotonLink>
        </Tarjeta>
      ) : (
        <Vacio titulo="No tenés un viaje en curso">Cuando salgas con un pedido, lo vas a ver acá.</Vacio>
      )}
    </div>
  );
}

// ───────────────────── Responsable de obra / Capataz ─────────────────────

async function InicioObra() {
  const pedidos = await misPedidos();
  return (
    <div className="lg:max-w-2xl">
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
              href={`/pedidos?ver=${p.id}`}
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
    </div>
  );
}

// ───────────────────────────── Depósito ─────────────────────────────

async function InicioDeposito() {
  const vencidas = await devolucionesVencidas();
  return (
    <div className="lg:max-w-2xl">
      <BotonLink href="/escanear" ancho tamano="grande" icono={<ScanLine className="size-7" />} className="min-h-[104px] text-xl">
        Escanear herramienta
      </BotonLink>
      <Subtitulo>Devoluciones vencidas</Subtitulo>
      {vencidas.length === 0 ? (
        <Vacio titulo="Ninguna vencida">Todo lo que está en obra está dentro de la fecha de devolución.</Vacio>
      ) : (
        <Lista>
          {vencidas.map((h) => (
            <FilaLista
              key={h.id}
              href={`/herramientas?ver=${h.codigo}`}
              titulo={h.nombre}
              detalle={`Obra ${h.obra?.nombre}${h.responsable ? ` · la tiene ${h.responsable.nombre}` : ""}`}
              derecha={<Insignia tono="critico">{vencimiento(h.devolucionPrevista!).texto}</Insignia>}
            />
          ))}
        </Lista>
      )}
    </div>
  );
}

// ───────────────────────────── Dirección ─────────────────────────────

async function InicioDireccion() {
  const r = await resumenDireccion();
  return (
    <div>
      <div className="relative grid h-[48dvh] min-h-72 place-items-center overflow-hidden rounded-[var(--radius-caja)] border border-linea bg-[#e9e9e5] lg:h-[60dvh]">
        <div aria-hidden className="absolute inset-0 opacity-60 [background-image:linear-gradient(#d6d6d1_1px,transparent_1px),linear-gradient(90deg,#d6d6d1_1px,transparent_1px)] [background-size:40px_40px]" />
        <div className="relative flex flex-col items-center gap-2 text-center">
          <Map className="size-10" />
          <p className="text-lg font-bold">Mapa en vivo</p>
          <p className="max-w-xs text-suave">Acá van a aparecer los vehículos con el rastreo de Cusat.</p>
          <BotonLink href="/mapa" variante="secundario" tamano="chico" className="mt-2">Abrir mapa</BotonLink>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 lg:gap-3">
        <Cifra etiqueta="Pedidos pendientes" valor={r.pendientes} tono={r.pendientes > 3 ? "aviso" : undefined} />
        <Cifra etiqueta="Vehículos en viaje" valor={r.enViaje} />
        <Cifra etiqueta="Alertas críticas" valor={r.criticas} tono={r.criticas ? "critico" : "ok"} />
      </div>
    </div>
  );
}

// ─────────────────────────── Administración ───────────────────────────

async function InicioAdministracion() {
  const [docs, costos] = await Promise.all([vencimientosProximos(), costoDelMesPorObra()]);
  const total = costos.reduce((a, c) => a + c.costo, 0);
  return (
    <div className="grid gap-x-6 lg:grid-cols-2">
      <section>
        <Subtitulo>Vencimientos próximos</Subtitulo>
        {docs.length === 0 ? (
          <Vacio titulo="Nada vence en los próximos 30 días" />
        ) : (
          <Lista>
            {docs.map((d) => {
              const v = vencimiento(d.vencimiento!);
              return (
                <FilaLista
                  key={d.id}
                  href={`/flota?ver=${d.vehiculo.id}`}
                  titulo={`${d.vehiculo.nombre} · ${DOCUMENTO[d.tipo]}`}
                  detalle={fecha(d.vencimiento)}
                  derecha={<Insignia tono={v.tono}>{v.texto}</Insignia>}
                />
              );
            })}
          </Lista>
        )}
      </section>
      <section>
        <Subtitulo>Costo del mes por obra</Subtitulo>
        {costos.length === 0 ? (
          <Vacio titulo="Sin viajes terminados este mes" icono={<AlertTriangle className="size-6" />} />
        ) : (
          <Lista>
            {costos.map((c) => (
              <li key={c.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">Obra {c.obra}</span>
                  <span className="font-bold tabular-nums">{plata(c.costo)}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-3">
                  <div className="h-1.5 flex-1 rounded-full bg-fondo">
                    <div className="h-full rounded-full bg-negro" style={{ width: `${total ? (c.costo / total) * 100 : 0}%` }} />
                  </div>
                  <span className="text-sm text-suave">{c.viajes} viajes</span>
                </div>
              </li>
            ))}
            <li className="flex justify-between px-4 py-3 font-bold">
              <span>Total</span>
              <span className="tabular-nums">{plata(total)}</span>
            </li>
          </Lista>
        )}
      </section>
    </div>
  );
}
