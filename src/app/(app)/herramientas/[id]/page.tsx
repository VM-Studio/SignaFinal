import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Pencil, Printer, Wrench } from "lucide-react";
import { exigirPermiso } from "@/lib/auth/sesion";
import { enlacePedido, puede } from "@/lib/permisos";
import { db } from "@/lib/db";
import { ficha, listar, opciones } from "@/lib/herramientas/consultas";
import { ListaDetalle } from "@/components/ui/lista-detalle";
import { CONDICION, ESTADO, MOVIMIENTO, type Accion } from "@/lib/herramientas/presentacion";
import { svgQR } from "@/lib/herramientas/qr";
import { Insignia, Subtitulo, Tarjeta, Vacio } from "@/components/ui/basicos";
import { ConHoja } from "@/components/ui/hoja";
import { claseBoton } from "@/components/ui/boton";
import { AccionesHerramienta } from "@/components/herramientas/acciones";
import { FormularioHerramienta } from "@/components/herramientas/formulario";
import { cuando, diaISO, fecha, plata, vencimiento } from "@/lib/formato";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const h = await db.herramienta.findUnique({ where: { id: (await params).id }, select: { nombre: true } });
  return { title: h?.nombre ?? "Herramienta" };
}

const ACCIONES: Accion[] = ["entregar", "devolver", "transferir", "reparar", "volvio", "extraviada", "baja", "pedir"];

export default async function FichaHerramienta({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ accion?: string }> }) {
  const u = await exigirPermiso("herramientas.ver");
  const { id } = await params;
  const a = (await searchParams).accion;
  const [h, ops] = await Promise.all([ficha(id), opciones()]);
  if (!h) notFound();
  const tabLista = h.tipoControl === "CANTIDAD" ? "cantidad" : h.esMaquina ? "maquinaria" : "herramientas";
  const lista = await listar({ tab: tabLista, limite: 200 });

  const qr = await svgQR(h.codigo);
  const cantidad = h.tipoControl === "CANTIDAD";
  const enDeposito = h.existencias.filter((e) => e.ubicacionId).reduce((s, e) => s + e.cantidad, 0);
  const enObras = h.existencias.filter((e) => e.obra && e.cantidad > 0).map((e) => ({ obraId: e.obra!.id, obra: e.obra!.nombre, cantidad: e.cantidad }));
  const misObras = ops.obras.filter((o) => (u.rol === "RESPONSABLE_OBRA" ? o.responsablesIds.includes(u.id) : u.rol === "CAPATAZ" || u.rol === "DIRECCION"));
  const pedido = h.pedidos[0];
  const devolucion = h.devolucionPrevista ? vencimiento(h.devolucionPrevista) : null;
  const proxMant = h.proximoMantenimiento ? vencimiento(h.proximoMantenimiento) : null;

  return (
    <ListaDetalle
      titulo={tabLista === "cantidad" ? "Por cantidad" : tabLista === "maquinaria" ? "Maquinaria" : "Herramientas"}
      verTodo={`/herramientas?tab=${tabLista}`}
      activo={h.id}
      items={lista.map((x) => ({ id: x.id, href: `/herramientas/${x.id}`, titulo: x.nombre, detalle: `${x.codigo} · ${x.donde}`, derecha: x.vencida ? <Insignia tono="critico">Vencida</Insignia> : undefined }))}
    >
    <div className="grid gap-x-6 gap-y-4 xl:grid-cols-[1fr_320px]">
      <header className="min-w-0 xl:col-start-1">
        <Link href="/herramientas" className="mb-2 hidden min-h-8 items-center gap-1 text-sm font-medium text-suave hover:text-tinta lg:inline-flex"><ArrowLeft className="size-4" /> Herramientas</Link>
        <div className="flex gap-4">
          {h.fotoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={h.fotoUrl} alt={h.nombre} className="size-24 shrink-0 rounded-[var(--radius-caja)] border border-linea object-cover lg:size-32" />
          )}
          <div className="min-w-0">
            <p className="etiqueta tabular-nums">{h.codigo} · {h.categoria.nombre}{h.esMaquina ? " · Máquina" : ""}</p>
            <h1 className="mt-1 text-[22px] leading-7 font-semibold">{h.nombre}</h1>
            <div className="mt-2 flex flex-wrap gap-2">
              {!cantidad && <Insignia tono={ESTADO[h.estado].tono}>{ESTADO[h.estado].texto}</Insignia>}
              {!cantidad && <Insignia tono={CONDICION[h.condicion].tono}>Condición {CONDICION[h.condicion].texto.toLowerCase()}</Insignia>}
              {h.vencida && <Insignia tono="critico">Devolución vencida</Insignia>}
            </div>
          </div>
        </div>
      </header>

      <aside className="flex flex-col gap-3 xl:sticky xl:top-[72px] xl:col-start-2 xl:row-span-2 xl:row-start-1 xl:self-start">
        <AccionesHerramienta
          accionInicial={a && (ACCIONES as string[]).includes(a) ? (a as Accion) : null}
          d={{
            herramienta: { id: h.id, nombre: h.nombre, estado: h.estado, tipoControl: h.tipoControl, esMaquina: h.esMaquina, obraId: h.obraId, responsableObraId: h.obra?.responsables[0]?.usuarioId ?? null, stockDeposito: enDeposito, existencias: enObras, mantenimientoCadaDias: h.mantenimientoCadaDias },
            obras: ops.obras,
            misObras,
            personas: ops.personas,
            yoId: u.id,
            puede: { mover: puede(u.rol, "herramientas.mover"), devolver: puede(u.rol, "herramientas.devolver"), editar: puede(u.rol, "herramientas.editar"), mantenimiento: puede(u.rol, "herramientas.mantenimiento"), pedir: puede(u.rol, "herramientas.solicitar") },
            pedidoActivo: pedido ? `Pedido ${pedido.numero}: ${pedido.solicitante.nombre} la pidió para Obra ${pedido.obra.nombre}${pedido.tomadoPor ? ` · la lleva ${pedido.tomadoPor.nombre}` : " · esperando chofer"}.` : null,
          }}
        />
        <Tarjeta className="flex items-center gap-4 p-4">
          <div className="size-24 shrink-0 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} />
          <div className="min-w-0">
            <p className="text-lg font-semibold tabular-nums">{h.codigo}</p>
            <p className="text-sm text-suave">Escaneá para abrir esta ficha.</p>
            {puede(u.rol, "herramientas.editar") && (
              <Link href={`/imprimir/etiquetas?ids=${h.id}`} target="_blank" className={claseBoton("secundario", "chico", false, "mt-2")}><Printer className="size-4" /> Imprimir etiqueta</Link>
            )}
          </div>
        </Tarjeta>
      </aside>

      <div className="min-w-0 xl:col-start-1">
        <Tarjeta className="p-4">
          <p className="etiqueta">Dónde está</p>
          {cantidad ? (
            <ul className="mt-1">
              <li className="flex justify-between py-1.5 font-semibold"><span>Depósito</span><span className="tabular-nums">{enDeposito}</span></li>
              {enObras.map((e) => <li key={e.obraId} className="flex justify-between border-t border-linea py-1.5"><span>Obra {e.obra}</span><span className="tabular-nums">{e.cantidad}</span></li>)}
            </ul>
          ) : (
            <>
              <p className="mt-1 text-2xl font-semibold">
                {h.estado === "EN_OBRA" ? `Obra ${h.obra?.nombre}` : h.estado === "DISPONIBLE" ? h.ubicacion?.nombre ?? "Depósito" : h.estado === "EN_REPARACION" ? "En el taller" : h.estado === "EXTRAVIADA" ? "No se sabe dónde está" : "Dada de baja"}
              </p>
              {h.responsable && <p className="text-suave">La tiene {h.responsable.nombre}</p>}
              {h.devolucionPrevista && devolucion && (
                <p className={`mt-1 font-semibold ${h.vencida ? "text-critico" : ""}`}>
                  Vuelve el {fecha(h.devolucionPrevista)}{h.vencida ? ` · ${devolucion.texto.replace("Vencido", "debía volver")}` : ""}
                </p>
              )}
            </>
          )}
        </Tarjeta>

        <dl className="mt-3 grid grid-cols-2 gap-3 rounded-[var(--radius-caja)] border border-linea bg-papel p-4 sm:grid-cols-3">
          {([
            ["Marca y modelo", [h.marca, h.modelo].filter(Boolean).join(" ") || "—"],
            ["N.º de serie", h.nroSerie ?? "—"],
            ["Valor de compra", h.valorCompra != null ? plata(h.valorCompra) : "—"],
            ["Mantenimiento", h.mantenimientoCadaDias ? `Cada ${h.mantenimientoCadaDias} días` : "Sin plan"],
            ["Próximo mantenimiento", h.proximoMantenimiento ? `${fecha(h.proximoMantenimiento)}${proxMant && proxMant.dias <= 15 ? ` (${proxMant.texto.toLowerCase()})` : ""}` : "—"],
          ] as [string, string][]).map(([k, v]) => (
            <div key={k}><dt className="etiqueta">{k}</dt><dd className="mt-0.5 font-medium">{v}</dd></div>
          ))}
        </dl>
        {puede(u.rol, "herramientas.editar") && h.activo && (
          <div className="mt-2">
            <ConHoja titulo={`Editar ${h.nombre}`} etiqueta="Editar datos" variante="fantasma" tamano="chico" icono={<Pencil />}>
              <FormularioHerramienta
                categorias={ops.categorias.map((c) => c.nombre)}
                inicial={{ id: h.id, nombre: h.nombre, categoria: h.categoria.nombre, esMaquina: h.esMaquina, tipoControl: h.tipoControl, marca: h.marca ?? "", modelo: h.modelo ?? "", nroSerie: h.nroSerie ?? "", valorCompra: h.valorCompra != null ? String(h.valorCompra) : "", mantenimientoCadaDias: h.mantenimientoCadaDias ? String(h.mantenimientoCadaDias) : "", fotoUrl: h.fotoUrl }}
              />
            </ConHoja>
          </div>
        )}

        <Subtitulo>Movimientos</Subtitulo>
        {h.movimientos.length === 0 ? (
          <Vacio titulo="Sin movimientos todavía" />
        ) : (
          <ol className="relative ml-2 border-l-2 border-linea pl-5">
            {h.movimientos.map((m) => {
              const desde = m.desdeObra ? `Obra ${m.desdeObra.nombre}` : m.desdeUbicacion?.nombre;
              const hacia = m.haciaObra ? `Obra ${m.haciaObra.nombre}` : m.haciaUbicacion?.nombre;
              return (
                <li key={m.id} className="relative pb-4 last:pb-0">
                  <span aria-hidden className="absolute top-1.5 -left-[27px] size-3 rounded-full border border-tinta bg-tinta" />
                  <p className="font-semibold">
                    {MOVIMIENTO[m.tipo]}
                    {cantidad ? ` · ${m.cantidad}` : ""}
                    {desde || hacia ? <span className="font-normal"> · {[desde, hacia].filter(Boolean).join(" → ")}</span> : null}
                  </p>
                  <p className="text-sm text-suave">
                    {cuando(m.fecha)} · registró {m.registradoPor.nombre}
                    {m.recibidoPor ? ` · recibió ${m.recibidoPor.nombre}` : ""}
                    {m.condicion ? ` · condición ${CONDICION[m.condicion].texto.toLowerCase()}` : ""}
                  </p>
                  {m.viaje && (enlacePedido(u.rol, m.viaje.pedidoId) ? (
                    <Link href={enlacePedido(u.rol, m.viaje.pedidoId)!} className="text-sm font-semibold underline">Viajó con {m.viaje.chofer.nombre} en {m.viaje.vehiculo.nombre}</Link>
                  ) : (
                    <p className="text-sm font-semibold">Viajó con {m.viaje.chofer.nombre} en {m.viaje.vehiculo.nombre}</p>
                  ))}
                  {m.observaciones && <p className="text-sm">{m.observaciones}</p>}
                </li>
              );
            })}
          </ol>
        )}

        {!cantidad && (
          <>
            <Subtitulo>Mantenimientos</Subtitulo>
            {h.mantenimientos.length === 0 ? (
              <Vacio icono={<Wrench className="size-8" />} titulo="Sin mantenimientos registrados" />
            ) : (
              <ul className="divide-y divide-linea overflow-hidden rounded-[var(--radius-caja)] border border-linea bg-papel">
                {h.mantenimientos.map((m) => (
                  <li key={m.id} className="flex min-h-14 items-center gap-3 px-4 py-2 lg:min-h-11">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{m.descripcion}</p>
                      <p className="text-sm text-suave">{fecha(m.fecha)}{m.taller ? ` · ${m.taller}` : ""} · {m.registradoPor.nombre}</p>
                    </div>
                    <p className="font-semibold tabular-nums">{plata(m.costo)}</p>
                  </li>
                ))}
              </ul>
            )}
            {h.proximoMantenimiento && diaISO(h.proximoMantenimiento) < diaISO() && <p className="mt-2 text-sm font-semibold text-critico">El mantenimiento está atrasado.</p>}
          </>
        )}
      </div>
    </div>
    </ListaDetalle>
  );
}
