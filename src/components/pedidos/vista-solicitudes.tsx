import Link from "next/link";
import { Eye, ListOrdered, MapPin } from "lucide-react";
import { leerFiltrosSolicitudes, opcionesSolicitudes, ORDENES_SOLICITUDES, solicitudesFiltradas, type FiltroSolicitud } from "@/lib/pedidos/solicitudes";
import { opcionesReasignar } from "@/lib/pedidos/consultas";
import { textoEstado, textoParaCuando, TIPO } from "@/lib/pedidos/presentacion";
import { diaISO } from "@/lib/formato";
import { vistasDe } from "@/lib/vistas/consultas";
import { BotonLink, claseBoton } from "@/components/ui/boton";
import { Insignia, Vacio } from "@/components/ui/basicos";
import { Fragment } from "react";
import { BarraFiltros } from "@/components/ui/barra-filtros";
import { BotonReasignar } from "./tomar";
import { BotonCancelar, EditarSolicitud } from "./acciones-solicitud";
import { IconoTipo } from "./iconos";

const ESTADOS: Record<string, string> = { PENDIENTE: "Pendiente", TOMADO: "Aceptado", EN_VIAJE: "En viaje", ENTREGADO: "Entregado", CANCELADO: "Cancelado" };
const horaArg = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit" }).format(d);

/**
 * SOLICITUDES con la barra de filtros única (Compras y Dirección): obra, lugar de retiro (agrupado:
 * "Corralón San Martín · 3 retiros"), quién pidió (con su historia), prioridad, fecha necesaria,
 * estado y chofer. Cada fila: fecha en palabras, lugar, destino, qué, quién (y quién coordinó), estado
 * y chofer, con "Ver seguimiento" y, si está pendiente, Editar y Cancelar (Dirección además Asignar).
 * `agrupada` (Compras): sin la columna de lugares; la tabla a todo el ancho (filas de 56 px), con el filtro
 * de fecha, y agrupada por lugar de retiro cuando ese filtro está puesto (fila gris "Corralón · 3 retiros").
 */
export async function VistaSolicitudes({ sp, ruta, agrupada = false }: { sp: Record<string, string | string[] | undefined>; ruta: string; agrupada?: boolean }) {
  const f = leerFiltrosSolicitudes(sp);
  const [datos, op, vistas] = await Promise.all([solicitudesFiltradas(f), opcionesSolicitudes(f), vistasDe("solicitudes")]);
  const asignar = datos.asignar ? Object.fromEntries(await Promise.all(datos.filas.filter((p) => p.estado === "PENDIENTE").map(async (p) => [p.id, await opcionesReasignar(p)] as const))) : {};
  const qs = (cambios: Record<string, string | null>) => {
    const n = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]);
    for (const [k, v] of Object.entries(cambios)) {
      if (v == null) n.delete(k);
      else n.set(k, v);
    }
    n.delete("pagina");
    const s = n.toString();
    return s ? `${ruta}?${s}` : ruta;
  };
  const pagina = (p: number) => { const u = qs({}); return `${u}${u.includes("?") ? "&" : "?"}pagina=${p}`; };
  const quien = (p: FiltroSolicitud) => `${p.solicitante.nombre}${p.coordinadoPor ? ` · coordinó ${p.coordinadoPor.nombre}` : ""}`;
  const acciones = (p: FiltroSolicitud, columna = false) => (
    // Compras (tabla de filas de 56 px): las acciones como íconos (el texto queda para lectores de pantalla y el title).
    <div className={columna ? (agrupada ? "flex items-center justify-end gap-1 whitespace-nowrap [&_button]:gap-0 [&_button]:px-2 [&_button]:text-[0px]" : "flex flex-col items-stretch gap-1 whitespace-nowrap") : "flex flex-wrap gap-2"}>
      {agrupada && columna ? (
        <Link href={`/solicitudes/${p.id}`} title="Ver seguimiento" className={claseBoton("secundario", "chico", false, "px-2")}><Eye /><span className="sr-only">Ver seguimiento</span></Link>
      ) : (
        <Link href={`/solicitudes/${p.id}`} className={claseBoton("secundario", "chico")}>Ver seguimiento</Link>
      )}
      {p.estado === "PENDIENTE" && datos.editar && (
        <EditarSolicitud p={{ id: p.id, dia: diaISO(p.paraCuando), franja: p.franja, hora: horaArg(p.paraCuando), prioridad: p.prioridad, descripcion: p.descripcion }} />
      )}
      {p.estado === "PENDIENTE" && datos.editar && <BotonCancelar pedidoId={p.id} chico />}
      {asignar[p.id] && <BotonReasignar pedidoId={p.id} numero={p.numero} choferes={asignar[p.id].choferes} vehiculos={asignar[p.id].vehiculos} etiqueta="Asignar" />}
    </div>
  );
  const estado = (p: FiltroSolicitud) => {
    const e = textoEstado({ estado: p.estado, chofer: p.tomadoPor?.nombre });
    return <Insignia tono={e.tono}>{ESTADOS[p.estado] ?? e.texto}</Insignia>;
  };
  const filtroPersona = f.pidio.length === 1 ? op.personas.find((x) => x.valor === f.pidio[0]) : null;
  // Con el filtro de lugar (Compras): las filas se agrupan por lugar de retiro, con la fila gris del grupo.
  const agrupar = agrupada && f.lugar.length > 0;
  const grupoNuevo = (k: number) => agrupar && (k === 0 || datos.filas[k - 1].origenNombre !== datos.filas[k].origenNombre);
  if (agrupar) datos.filas.sort((a, b) => a.origenNombre.localeCompare(b.origenNombre, "es"));
  const cuantosEn = (lugar: string) => op.grupos.find((g) => g.lugar === lugar)?.cantidad ?? datos.filas.filter((x) => x.origenNombre === lugar).length;

  return (
    <div className={agrupada ? "flex min-w-0 flex-1 flex-col" : ""}>
      <BarraFiltros
        pantalla="solicitudes"
        vistas={vistas}
        buscador={{ placeholder: "Qué, lugar o destino" }}
        orden={{ opciones: ORDENES_SOLICITUDES, porDefecto: "fecha" }}
        filtros={[
          { tipo: "opciones", clave: "obra", etiqueta: "Obra", opciones: op.obras },
          { tipo: "opciones", clave: "lugar", etiqueta: agrupada ? "Lugar" : "Lugar de retiro", opciones: op.lugares },
          { tipo: "opciones", clave: "pidio", etiqueta: agrupada ? "Persona" : "Pidió", opciones: op.personas },
          { tipo: "opciones", clave: "prioridad", etiqueta: "Prioridad", opciones: [{ valor: "URGENTE", etiqueta: "Urgente" }, { valor: "NORMAL", etiqueta: "Normal" }] },
          ...(agrupada ? [{ tipo: "rango" as const, claveDesde: "desde", claveHasta: "hasta", etiqueta: "Fecha" }] : []),
          { tipo: "opciones", clave: "estado", etiqueta: "Estado", opciones: Object.entries(ESTADOS).map(([valor, etiqueta]) => ({ valor, etiqueta, cantidad: op.estados.find((x) => x.valor === valor)?.cantidad })) },
          { tipo: "opciones", clave: "chofer", etiqueta: "Chofer", opciones: op.choferes },
        ]}
      />
      {filtroPersona && <p className="mb-3 text-sm text-suave">Todos los viajes que pidió <b className="font-medium text-tinta">{filtroPersona.etiqueta}</b>, incluidos los pasados.</p>}

      <div className={agrupada ? "flex min-w-0 flex-1 flex-col" : "grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_280px]"}>
        <div className={agrupada ? "flex min-w-0 flex-1 flex-col" : "min-w-0"}>
          {datos.total === 0 ? (
            <Vacio llenar={agrupada} icono={<ListOrdered className="size-10" />} titulo="No hay solicitudes con esos filtros">Probá sacando alguno.</Vacio>
          ) : (
            <>
              <p className="mb-2 text-[12px] text-suave">{datos.total === 1 ? "1 solicitud" : `${datos.total} solicitudes`}{datos.paginas > 1 ? ` · página ${f.pagina} de ${datos.paginas}` : ""}</p>
              {/* Celular: filas */}
              <ul className={`divide-y divide-linea border-y border-linea bg-papel lg:hidden ${agrupada ? "-mx-4" : ""}`}>
                {datos.filas.map((p) => (
                  <li key={p.id} data-vivo-id={p.id} className={`flex flex-col gap-1 py-3 ${agrupada ? "px-4" : "px-1"}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold uppercase">{textoParaCuando(p.paraCuando, p.franja)}</span>
                      {p.prioridad === "URGENTE" && p.estado === "PENDIENTE" && <Insignia tono="critico">Urgente</Insignia>}
                      <span className="ml-auto">{estado(p)}</span>
                    </div>
                    <p className="text-[15px] font-medium">{p.descripcion}</p>
                    <p className="text-[13px] text-suave">{p.origenNombre} → Obra {p.obra.nombre} · Pidió {quien(p)}{p.tomadoPor ? ` · ${p.tomadoPor.nombre}` : ""}</p>
                    <div className="mt-1">{acciones(p)}</div>
                  </li>
                ))}
              </ul>
              {/* Escritorio: tabla */}
              <div className="hidden overflow-x-auto rounded-[var(--radius-caja)] border border-linea bg-papel lg:block">
                <table className={`tabla ${agrupada ? "tabla-56 table-fixed" : ""}`}>
                  {/* Compras: anchos fijos (el texto largo se corta con "…" y la fila queda en 56 px). */}
                  {agrupada && <colgroup><col className="w-[140px]" /><col className="w-[180px]" /><col className="w-[150px]" /><col /><col className="w-[124px]" /><col className="w-[112px]" /><col className="w-[124px]" /><col className="w-[124px]" /></colgroup>}
                  <thead><tr><th>Para cuándo</th><th>Retiro en</th><th>Destino</th><th>Qué</th><th>Pidió</th><th>Estado</th><th>Chofer</th><th /></tr></thead>
                  <tbody>
                    {datos.filas.map((p, k) => (
                      <Fragment key={p.id}>
                      {grupoNuevo(k) && (
                        <tr className="bg-fondo hover:bg-fondo">
                          <td colSpan={8} className="h-9 border-b border-linea text-[12px] font-semibold"><MapPin className="mr-1.5 inline size-3.5 text-suave" />{p.origenNombre} · <span className="font-normal text-suave">{cuantosEn(p.origenNombre)} {cuantosEn(p.origenNombre) === 1 ? "retiro" : "retiros"}</span></td>
                        </tr>
                      )}
                      <tr data-vivo-id={p.id} className={agrupada ? "align-middle" : "align-top"}>
                        <td className="whitespace-nowrap">{textoParaCuando(p.paraCuando, p.franja)}{p.prioridad === "URGENTE" && p.estado === "PENDIENTE" && <Insignia tono="critico" className="mt-1">Urgente</Insignia>}</td>
                        <td className={agrupada ? "" : "min-w-36"}><Link href={qs({ lugar: p.origenNombre })} title={p.origenNombre} className={`hover:underline ${agrupada ? "block truncate" : ""}`}>{p.origenNombre}</Link></td>
                        <td><span className={agrupada ? "block truncate" : ""} title={`Obra ${p.obra.nombre}`}>Obra {p.obra.nombre}</span></td>
                        <td className={agrupada ? "" : "max-w-64 min-w-40"}><span className="flex min-w-0 items-start gap-2"><IconoTipo tipo={p.tipo} /><span className={agrupada ? "truncate" : "line-clamp-2"} title={p.descripcion}>{p.descripcion}</span></span><span className="text-[12px] text-suave">{TIPO[p.tipo].corto} · #{p.numero}</span></td>
                        <td className="whitespace-nowrap"><Link href={qs({ pidio: p.solicitante.id })} className="hover:underline">{p.solicitante.nombre}</Link>{p.coordinadoPor && <span className="block text-[12px] text-suave">coordinó {p.coordinadoPor.nombre}</span>}</td>
                        <td>{estado(p)}</td>
                        <td className="whitespace-nowrap">{p.tomadoPor?.nombre ?? "—"}{p.viaje?.vehiculo ? <span className="block text-[12px] text-suave">{p.viaje.vehiculo.nombre}</span> : null}</td>
                        <td className="w-px">{acciones(p, true)}</td>
                      </tr>
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              {datos.paginas > 1 && (
                <nav className="mt-3 flex items-center justify-between gap-2" aria-label="Páginas">
                  {f.pagina > 1 ? <BotonLink href={pagina(f.pagina - 1)} variante="secundario">Anterior</BotonLink> : <span />}
                  <span className="text-sm text-suave">Página {f.pagina} de {datos.paginas}</span>
                  {f.pagina < datos.paginas ? <BotonLink href={pagina(f.pagina + 1)} variante="secundario">Siguiente</BotonLink> : <span />}
                </nav>
              )}
            </>
          )}
        </div>
        {/* Agrupado por lugar de retiro: al tocar, solo esos. */}
        {!agrupada && <aside className="order-first min-w-0 lg:order-none">
          <p className="etiqueta mb-2 flex items-center gap-1.5"><MapPin className="size-3.5" /> Por lugar de retiro</p>
          <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
            {op.grupos.map((g) => {
              const activo = f.lugar.length === 1 && f.lugar[0] === g.lugar;
              return (
                <li key={g.lugar} className="shrink-0">
                  <Link href={qs({ lugar: activo ? null : g.lugar })} scroll={false} className={`flex items-center justify-between gap-3 rounded-[var(--radius-caja)] border px-3 py-2 text-sm ${activo ? "border-tinta bg-black/[0.04]" : "border-linea bg-papel hover:bg-hover"}`}>
                    <span className="truncate font-medium">{g.lugar}</span>
                    <span className="shrink-0 text-suave tabular-nums">{g.cantidad} {g.cantidad === 1 ? "retiro" : "retiros"}</span>
                  </Link>
                </li>
              );
            })}
            {op.grupos.length === 0 && <li className="text-sm text-suave">Sin retiros.</li>}
          </ul>
        </aside>}
      </div>
    </div>
  );
}
