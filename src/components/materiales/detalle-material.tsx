import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, MessageSquareText, Phone, Truck } from "lucide-react";
import { ListaAdjuntos } from "@/components/adjuntos/lista";
import { AdjuntarCompras, NotasCompras } from "./extras-compras";
import { exigirSesion } from "@/lib/auth/sesion";
import { detalleMaterial, proveedoresParaHabilitar } from "@/lib/materiales/consultas";
import { seguimiento } from "@/lib/viajes/seguimiento";
import { ESTADO_LISTO, ESTADO_MATERIAL, fraseMaterial, haceDias, MODO_ENTREGA, nroOC, ordenEstado, PASOS_MATERIAL, demorado } from "@/lib/materiales/presentacion";
import { aFecha, cuando, fecha, hora, paraElDia, peso, plata } from "@/lib/formato";
import { modoDemo } from "@/lib/demo";
import { puede } from "@/lib/permisos";
import { Insignia, Subtitulo, Tarjeta } from "@/components/ui/basicos";
import { BotonLink } from "@/components/ui/boton";
import { SeguimientoViaje } from "@/components/viajes/seguimiento-viaje";
import {
  BotonAprobadoEnPapel, BotonCancelarMaterial, BotonesAprobacion, BotonHabilitar, BotonPedirAprobacion, BotonRecibido, BotonTomarMaterial,
} from "./acciones-material";

/** Fecha sin hora (@db.Date): el mediodía argentino de ese día. */
const delDia = (d: Date) => aFecha(d.toISOString().slice(0, 10), "12:00");

/** Detalle de un pedido de material: el mismo para Compras (/compras/[id]) y para la obra (/mis-pedidos/material/[id]). */
export async function DetalleMaterial({ id, vista }: { id: string; vista: "compras" | "obra" }) {
  const u = await exigirSesion();
  const p = await detalleMaterial(id);
  if (!p) notFound();
  const gestiona = vista === "compras" && p.gestiona;
  const habilitable = gestiona && !p.completo && ["APROBADO", "LISTO_PARA_RETIRAR", "RETIRO_PEDIDO", "EN_CAMINO"].includes(p.estado);
  const proveedores = habilitable ? await proveedoresParaHabilitar() : [];
  const conViaje = p.materialesListos.filter((m) => m.pedidoViaje && m.estado !== "CANCELADO" && m.pedidoViaje.estado !== "CANCELADO" && m.pedidoViaje.estado !== "PENDIENTE");
  const viajes = [...new Map(conViaje.map((m) => [m.pedidoViaje!.id, m.pedidoViaje!])).values()];
  const seguimientos = (await Promise.all(viajes.map(async (v) => ({ v, s: await seguimiento(u, v.id) })))).filter((x) => x.s);

  const listo = p.materialesListos.find((m) => m.estado === "LISTO" && m.modoEntrega === "RETIRA_CHOFER");
  const enCamino = p.materialesListos.find((m) => m.estado === "EN_CAMINO")?.pedidoViaje?.viaje?.etaDestino;
  const desde = p.cambios.at(-1)?.fecha ?? p.creadoEn;
  const obraPuedePedir = vista === "obra" && puede(u.rol, "pedidos.crear");
  const cancelaObra = vista === "obra" && p.esMio && p.estado === "SOLICITADO";
  const cancelaCompras = gestiona && !["CANCELADO", "ENTREGADO"].includes(p.estado);
  const recibibles = p.materialesListos.filter((m) => m.modoEntrega === "ENTREGA_PROVEEDOR" && m.estado === "EN_CAMINO");

  // UN botón grande con lo que sigue.
  let principal: React.ReactNode = null;
  if (gestiona) {
    if (p.estado === "SOLICITADO") principal = <BotonTomarMaterial id={p.id} />;
    else if (p.estado === "EN_COMPRA") principal = <BotonPedirAprobacion id={p.id} ocInicial={p.ordenCompraNumero} />;
    else if (p.estado === "ESPERANDO_APROBACION") principal = p.aprueba ? <BotonesAprobacion id={p.id} oc={p.ordenCompraNumero} /> : (
      <>
        <p className="flex min-h-12 items-center justify-center gap-2 rounded-md bg-aviso-fondo px-4 text-center text-sm font-medium text-aviso lg:min-h-9"><Clock className="size-4" /> Esperando al dueño</p>
        <BotonAprobadoEnPapel id={p.id} />
      </>
    );
    else if (habilitable) principal = <BotonHabilitar id={p.id} proveedores={proveedores} oc={p.ordenCompraNumero} descripcion={p.descripcion} otraParte={p.estado !== "APROBADO"} destino={p.obraSede ? { lat: p.obraSede.latitud, lng: p.obraSede.longitud } : { lat: p.obra.latitud, lng: p.obra.longitud }} />;
  } else if (obraPuedePedir && listo) {
    principal = <BotonLink href={`/pedir/retiro?obra=${p.obraId}&material=${listo.id}`} ancho icono={<Truck />}>Pedir el viaje</BotonLink>;
  }
  const acciones = [principal, ...recibibles.map((m) => (vista === "obra" || gestiona) && <BotonRecibido key={m.id} materialListoId={m.id} />), (cancelaObra || cancelaCompras) && <BotonCancelarMaterial key="c" id={p.id} />].filter(Boolean);

  const volver = vista === "compras" ? { href: "/compras", titulo: "Pedidos de material" } : { href: "/mis-pedidos?tab=materiales", titulo: "Mis pedidos" };
  const estado = ESTADO_MATERIAL[p.estado];
  const pasoActual = ordenEstado(p.estado);
  const observacionesSolicitante = p.observaciones?.trim() || null;

  return (
    <div className="grid gap-x-6 gap-y-4 lg:grid-cols-[1fr_320px]">
      <header className="min-w-0 lg:col-start-1">
        <Link href={volver.href} className="mb-2 hidden min-h-8 items-center gap-1 text-sm font-medium text-suave hover:text-tinta lg:inline-flex"><ArrowLeft className="size-4" /> {volver.titulo}</Link>
        <p className="etiqueta">Pedido de material {p.numero} · Obra {p.obra.nombre}{p.obraSede ? ` · ${p.obraSede.nombre}` : ""}</p>
        <h1 className="mt-1 text-xl leading-7 font-semibold whitespace-pre-line lg:text-[22px]">{p.descripcion}</h1>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {vista === "obra" ? (
            <Insignia tono={listo ? "ok" : estado.tono}>{fraseMaterial(listo ? "LISTO_PARA_RETIRAR" : p.estado, { proveedor: listo?.proveedor.nombre, llega: enCamino ? hora(enCamino) : null })}</Insignia>
          ) : (
            <Insignia tono={estado.tono}>{estado.titulo}</Insignia>
          )}
          {p.prioridad === "URGENTE" && <Insignia tono="critico">Urgente</Insignia>}
          {gestiona && demorado(p.estado, desde) && <Insignia tono="critico">Demorado: {haceDias(desde).replace("hace ", "")} en este paso</Insignia>}
        </div>
        {p.estado === "CANCELADO" && p.motivoCancelacion && <p className="mt-3 font-medium text-suave">Cancelado: {p.motivoCancelacion}</p>}
      </header>

      {acciones.length > 0 && (
        <aside className="flex flex-col gap-2 lg:sticky lg:top-[72px] lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start lg:rounded-[var(--radius-caja)] lg:border lg:border-linea lg:bg-papel lg:p-4">
          {acciones}
        </aside>
      )}

      <div className="min-w-0 lg:col-start-1">
        {/* Lo primero que lee Compras: lo que escribió el que pidió. */}
        {observacionesSolicitante && (
          <section className="mb-3 rounded-[var(--radius-caja)] border border-tinta/15 bg-hover p-4">
            <p className="etiqueta flex items-center gap-1.5"><MessageSquareText className="size-3.5" /> Observaciones del solicitante</p>
            <p className="mt-1.5 text-[15px] leading-6 whitespace-pre-line">{observacionesSolicitante}</p>
          </section>
        )}
        {p.adjuntos.length > 0 && (
          <section className="mb-3">
            <p className="etiqueta mb-2">Archivos adjuntos ({p.adjuntos.length})</p>
            <ListaAdjuntos adjuntos={p.adjuntos} />
          </section>
        )}
        {p.renglones.length > 0 && (
          <section className="mb-3 overflow-hidden rounded-[var(--radius-caja)] border border-linea bg-papel">
            <table className="tabla">
              <thead><tr><th>Material</th><th className="num">Cantidad</th><th>Unidad</th></tr></thead>
              <tbody>
                {p.renglones.map((r, i) => (
                  <tr key={i}><td>{r.descripcion}</td><td className="num">{r.cantidad != null ? Number(r.cantidad).toLocaleString("es-AR") : "—"}</td><td className="text-suave">{r.cantidad != null ? r.unidad ?? "" : ""}</td></tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
        <dl className="grid grid-cols-2 gap-4 rounded-[var(--radius-caja)] border border-linea bg-papel p-4 sm:grid-cols-3">
          {[
            ["Para cuándo", paraElDia(delDia(p.paraCuando)).replace(/^para /, "")],
            ["Pidió", p.solicitante.nombre],
            ["Compras", p.tomadoPor?.nombre ?? "Sin tomar"],
            p.ordenCompraNumero ? ["Orden de compra", nroOC(p.ordenCompraNumero)!] : null,
            p.monto != null && (gestiona || p.aprueba) ? ["Monto", plata(p.monto)] : null,
            p.aprobadoPor ? ["Aprobó", `${p.aprobadoPor.nombre} · ${cuando(p.aprobadoEn)}`] : null,
          ]
            .filter((x): x is [string, string] => !!x)
            .map(([k, v]) => (
              <div key={k}>
                <dt className="etiqueta">{k}</dt>
                <dd className="mt-1 text-sm font-medium">{v}</dd>
              </div>
            ))}
        </dl>
        {gestiona && (
          <section className="mt-3 flex flex-col gap-4 rounded-[var(--radius-caja)] border border-linea bg-papel p-4">
            <NotasCompras id={p.id} inicial={p.notasCompras ?? ""} />
            <AdjuntarCompras id={p.id} />
          </section>
        )}
        {gestiona && p.solicitante.telefono && (
          <a href={`tel:${p.solicitante.telefono.replace(/\s/g, "")}`} className="mt-2 inline-flex min-h-9 items-center gap-1.5 text-sm font-medium underline"><Phone className="size-4" /> Llamar a {p.solicitante.nombre}</a>
        )}

        {p.materialesListos.length > 0 && (
          <>
            <Subtitulo>Habilitado para retirar</Subtitulo>
            <ul className="flex flex-col gap-2">
              {p.materialesListos.map((m) => (
                <li key={m.id}>
                  <Tarjeta className={`p-4 ${m.estado === "LISTO" ? "border-ok/30" : ""}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="font-medium">{m.descripcion}</p>
                      <Insignia tono={ESTADO_LISTO[m.estado].tono}>{m.modoEntrega === "ENTREGA_PROVEEDOR" && m.estado === "EN_CAMINO" ? "Lo trae el proveedor" : ESTADO_LISTO[m.estado].titulo}</Insignia>
                    </div>
                    <p className="mt-1 text-sm text-suave">{m.proveedor.nombre} · {m.proveedorDireccion}</p>
                    <p className="text-[12px] text-suave">
                      {[
                        m.modoEntrega === "ENTREGA_PROVEEDOR" ? `${MODO_ENTREGA.ENTREGA_PROVEEDOR}${m.fechaEntregaEstimada ? ` el ${fecha(delDia(m.fechaEntregaEstimada))}` : ""}` : m.horarioRetiro && `Retiro: ${m.horarioRetiro}`,
                        m.contactoRetiro && `Contacto: ${m.contactoRetiro}`,
                        nroOC(m.ordenCompraNumero),
                        m.pesoKg ? `hasta ${peso(m.pesoKg)}` : null,
                        `habilitado ${haceDias(m.habilitadoEn)} por ${m.habilitadoPor.nombre}`,
                        m.pedidoViaje && `viaje #${m.pedidoViaje.numero}${m.pedidoViaje.tomadoPor ? ` con ${m.pedidoViaje.tomadoPor.nombre}` : " (esperando chofer)"}`,
                        m.entregadoEn && `entregado ${cuando(m.entregadoEn)}`,
                      ].filter(Boolean).join(" · ")}
                    </p>
                  </Tarjeta>
                </li>
              ))}
            </ul>
          </>
        )}

        {seguimientos.map(({ v, s }) => (
          <div key={v.id}>
            <Subtitulo accion={vista === "obra" ? <Link href={`/mis-pedidos/${v.id}`} className="text-sm font-medium underline">Ver el viaje</Link> : undefined}>Viaje #{v.numero}</Subtitulo>
            <SeguimientoViaje embebido pedidoId={v.id} inicial={s!} demo={modoDemo() && u.rol === "DIRECCION"} />
          </div>
        ))}

        <Subtitulo>Línea de tiempo</Subtitulo>
        <ol className="relative ml-1.5 border-l border-linea pl-5">
          {PASOS_MATERIAL.map((paso, i) => {
            const hecho = p.estado !== "CANCELADO" && i <= pasoActual;
            const cambio = [...p.cambios].reverse().find((c) => c.a === paso.estado);
            return (
              <li key={paso.estado} className="relative pb-4 last:pb-0">
                <span aria-hidden className={`absolute top-1.5 -left-[25px] size-2 rounded-full ${hecho ? "bg-tinta" : "border border-linea-fuerte bg-papel"}`} />
                <p className={`text-sm ${hecho ? "font-medium" : "text-suave"}`}>{paso.titulo}</p>
                {hecho && cambio && <p className="text-[12px] text-suave">{[cuando(cambio.fecha), cambio.usuario?.nombre, cambio.nota].filter(Boolean).join(" · ")}</p>}
              </li>
            );
          })}
          {p.estado === "CANCELADO" && (
            <li className="relative">
              <span aria-hidden className="absolute top-1.5 -left-[25px] size-2 rounded-full bg-critico" />
              <p className="text-sm font-medium text-critico">Cancelado{p.motivoCancelacion ? `: ${p.motivoCancelacion}` : ""}</p>
              {p.cambios.at(-1) && <p className="text-sm text-suave">{cuando(p.cambios.at(-1)!.fecha)} · {p.cambios.at(-1)!.usuario?.nombre}</p>}
            </li>
          )}
        </ol>
        {/* Los rechazos y "aprobado en papel" quedan en el historial completo. */}
        {gestiona && p.cambios.some((c) => c.nota?.startsWith("Rechazado")) && (
          <>
            <Subtitulo>Historial</Subtitulo>
            <ul className="divide-y divide-linea rounded-[var(--radius-caja)] border border-linea bg-papel">
              {p.cambios.map((c) => (
                <li key={c.id} className="px-4 py-2 text-sm">
                  <span className="font-medium">{ESTADO_MATERIAL[c.a].titulo}</span> · {cuando(c.fecha)}{c.usuario ? ` · ${c.usuario.nombre}` : ""}{c.nota ? ` · ${c.nota}` : ""}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
