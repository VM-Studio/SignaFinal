import Link from "next/link";
import { ClipboardList, FileSpreadsheet, FilePen, PlusCircle, X } from "lucide-react";
import { exigirSesion } from "@/lib/auth/sesion";
import { puede } from "@/lib/permisos";
import { contadoresTablero, leerFiltros, opcionesTablero, ORDENES_TABLERO, tablero } from "@/lib/compras/tablero";
import { ordenesCompra, ordenPorId } from "@/lib/compras/consultas";
import { ESTADO_TABLERO, LEYENDA_TABLERO, PLANILLA_TABLERO } from "@/lib/compras/estadoTablero";
import { vistasDe } from "@/lib/vistas/consultas";
import { BotonLink, claseBoton } from "@/components/ui/boton";
import { PaginaCompleta, Titulo, Vacio } from "@/components/ui/basicos";
import { BarraFiltros } from "@/components/ui/barra-filtros";
import { ListaTablero, TablaTablero } from "@/components/compras/tablero";
import { DetalleOrden } from "@/components/compras/detalle-orden";

type Sp = Record<string, string | string[] | undefined>;

/** Tarjeta-filtro de arriba (88px, número a 28px): la activa con borde negro y fondo gris muy claro. */
function TarjetaFiltro({ href, etiqueta, valor, activa }: { href: string; etiqueta: string; valor: number; activa: boolean }) {
  return (
    <Link href={href} scroll={false} aria-current={activa ? "true" : undefined}
      className={`flex h-[88px] min-w-0 flex-col justify-between rounded-[var(--radius-caja)] border p-4 ${activa ? "border-negro bg-hover" : "border-linea bg-papel hover:border-linea-fuerte"}`}>
      <span className="etiqueta truncate">{etiqueta}</span>
      <span className="text-[28px] leading-8 font-semibold tabular-nums">{valor.toLocaleString("es-AR")}</span>
    </Link>
  );
}

/** La leyenda de arriba a la derecha de su planilla: un cuadradito por código. */
function Leyenda() {
  return (
    <ul className="hidden h-[88px] flex-col justify-between py-0.5 text-[12px] lg:flex" aria-label="Referencias de estado">
      {LEYENDA_TABLERO.map((l) => {
        const p = PLANILLA_TABLERO[l.estado];
        return (
          <li key={l.codigo} className="flex h-5 items-center gap-2 whitespace-nowrap">
            <span className="grid size-4 place-items-center rounded-[3px] border border-[#BFBFBF] text-[11px] font-semibold tabular-nums" style={{ background: p.fondo, color: p.texto }}>{l.codigo}</span>
            <span className="text-suave">{l.palabra}</span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * ÓRDENES = TABLERO DE CONTROL de Compras (/compras/ordenes; Administración lo mira en /compras/tablero).
 * Arriba, cuatro tarjetas-filtro (Todas · Pedir autorización · Encargado · Entregado este mes) con la
 * leyenda de su planilla; la barra de filtros en una fila; la franja "Planilla de control COMPRAS" y la
 * planilla. Tocar una fila abre la orden completa en un panel de 560 px (el tablero no se va).
 */
export async function PaginaTablero({ sp, ruta }: { sp: Sp; ruta: string }) {
  const u = await exigirSesion();
  const f = leerFiltros(sp);
  const ver = typeof sp.ver === "string" ? sp.ver : null;
  const gestiona = puede(u.rol, "materiales.gestionar");
  const [datos, cont, op, vistas, orden, borradores] = await Promise.all([
    tablero(f), contadoresTablero(f), opcionesTablero(), vistasDe("tablero"), ver ? ordenPorId(ver) : null,
    gestiona ? ordenesCompra({}, 1).then((r) => r.borradores) : Promise.resolve([]),
  ]);
  const plano = Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][];
  const qs = new URLSearchParams(plano.filter(([k]) => k !== "ver" && k !== "pagina")).toString();
  const url = (cambios: Record<string, string | null>) => {
    const n = new URLSearchParams(plano.filter(([k]) => k !== "ver" && k !== "pagina"));
    for (const [k, v] of Object.entries(cambios)) {
      if (v == null) n.delete(k);
      else n.set(k, v);
    }
    const s = n.toString();
    return s ? `${ruta}?${s}` : ruta;
  };
  const pagina = (n: number) => url({ pagina: n > 1 ? String(n) : null });
  const hayFiltros = qs.replace(/(^|&)orden=[^&]*/, "").length > 0;
  const soloEstado = (e: string | null, mes = false) => url({ estado: e, entregado: mes ? "mes" : null });
  const estadoUnico = f.estado.length === 1 ? f.estado[0] : null;
  const detalle = orden ? <DetalleOrden oc={orden} editable={gestiona} autorizaPago={datos.autorizaPago} compacto /> : null;
  const nombre = u.rol === "COMPRAS" ? u.nombre.split(" ")[0] : "Alejandra";

  return (
    <PaginaCompleta>
      <Titulo siempre
        accion={
          <>
            {gestiona && <BotonLink href="/compras/ordenes/nueva" icono={<PlusCircle />}>Nueva OC</BotonLink>}
            {gestiona && <BotonLink href="/compras/ordenes/nueva?tipo=PE" variante="secundario" icono={<PlusCircle />}>Nuevo PE</BotonLink>}
            <a href={`/api/compras/tablero/exportar${qs ? `?${qs}` : ""}`} className={claseBoton("secundario")}><FileSpreadsheet /> Exportar a Excel</a>
          </>
        }>
        Órdenes
      </Titulo>

      <div className="mb-4 grid gap-6 lg:mb-6 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-4">
          <TarjetaFiltro href={soloEstado(null)} etiqueta="Todas" valor={cont.todas} activa={!f.estado.length && !f.mes} />
          <TarjetaFiltro href={soloEstado("PEDIR_AUTORIZACION")} etiqueta="Pedir autorización" valor={cont.pedir} activa={estadoUnico === "PEDIR_AUTORIZACION" && !f.mes} />
          <TarjetaFiltro href={soloEstado("ENCARGADO")} etiqueta="Encargado" valor={cont.encargado} activa={estadoUnico === "ENCARGADO" && !f.mes} />
          <TarjetaFiltro href={soloEstado(null, true)} etiqueta="Entregado este mes" valor={cont.entregadoMes} activa={!!f.mes && !f.estado.length} />
        </div>
        <Leyenda />
      </div>

      <BarraFiltros
        pantalla="tablero"
        vistas={vistas}
        otrasClaves={["entregado"]}
        buscador={{ placeholder: "Buscar materiales, número u observaciones" }}
        orden={{ opciones: ORDENES_TABLERO, porDefecto: "caducidad" }}
        filtros={[
          { tipo: "opciones", clave: "tipo", etiqueta: "Tipo", opciones: [{ valor: "OC", etiqueta: "OC · orden de compra" }, { valor: "PE", etiqueta: "PE · pedido especial" }] },
          { tipo: "opciones", clave: "obra", etiqueta: "Obra", opciones: op.obras },
          { tipo: "opciones", clave: "sol", etiqueta: "Solicitado por", opciones: op.solicitantes },
          { tipo: "opciones", clave: "prov", etiqueta: "Proveedor", opciones: op.proveedores },
          { tipo: "opciones", clave: "estado", etiqueta: "Estado", opciones: op.estados.map((e) => ({ valor: e.valor, etiqueta: ESTADO_TABLERO[e.valor].titulo, cantidad: e.cantidad })) },
          { tipo: "rango", claveDesde: "desde", claveHasta: "hasta", etiqueta: "Fecha" },
          { tipo: "rango", claveDesde: "edesde", claveHasta: "ehasta", etiqueta: "Fecha de entrega" },
        ]}
      />

      {/* Borradores (sin número): no están en la planilla hasta que se envían; se retoman desde acá. */}
      {borradores.length > 0 && (
        <div className="mb-4 flex min-w-0 items-center gap-2 overflow-x-auto text-[13px]">
          <span className="etiqueta shrink-0">Borradores sin enviar</span>
          {borradores.slice(0, 6).map((b) => (
            <Link key={b.id} href={`/compras/ordenes/${b.id}`} className="inline-flex h-8 max-w-64 shrink-0 items-center gap-1.5 rounded-full border border-linea bg-papel px-3 hover:border-linea-fuerte">
              <FilePen className="size-3.5 shrink-0 text-suave" /><span className="font-medium">{b.tipo}</span>
              <span className="truncate text-suave">{b.detallePedido?.split("\n")[0] || b.obra || "sin detalle"}</span>
            </Link>
          ))}
          {borradores.length > 6 && <span className="shrink-0 text-suave">y {borradores.length - 6} más</span>}
        </div>
      )}

      {/* La franja de título de su planilla. */}
      <div className="-mx-4 flex h-9 shrink-0 items-center justify-between gap-3 border-y border-[#BFBFBF] bg-[#F2DCDB] px-4 lg:mx-0 lg:border-x lg:border-b-0">
        <p className="truncate text-[15px] italic">Planilla de control COMPRAS - {nombre}</p>
        <p className="shrink-0 text-[12px] text-[#595959] tabular-nums">{datos.total === 1 ? "1 orden" : `${datos.total.toLocaleString("es-AR")} órdenes`}{datos.paginas > 1 ? ` · página ${f.pagina} de ${datos.paginas}` : ""}</p>
      </div>

      {datos.total === 0 ? (
        <Vacio llenar icono={<ClipboardList className="size-10" />} titulo={hayFiltros ? "Ninguna orden con esos filtros" : "Todavía no hay órdenes"}
          accion={hayFiltros ? <BotonLink href={ruta} variante="secundario" icono={<X />}>Limpiar filtros</BotonLink> : undefined}>
          {hayFiltros ? "Probá sacando alguno." : gestiona ? "Creá la primera con “Nueva OC” o “Nuevo PE”." : null}
        </Vacio>
      ) : (
        <>
          <div className={orden ? "lg:grid lg:grid-cols-[minmax(0,1fr)_560px] lg:gap-4" : ""}>
            <div className="min-w-0">
              <TablaTablero filas={datos.filas} editable={gestiona} />
              <ListaTablero filas={datos.filas} editable={gestiona} detalle={detalle} />
            </div>
            {orden && (
              <aside className="@container hidden min-w-0 lg:block">
                <div className="sticky top-[calc(var(--alto-header)+24px)] max-h-[calc(100dvh-var(--alto-header)-48px)] overflow-y-auto rounded-[var(--radius-caja)] border border-linea bg-papel p-4">
                  <div className="mb-2 flex justify-end"><Link scroll={false} href={pagina(f.pagina)} className="inline-flex items-center gap-1 text-[12px] font-medium text-suave hover:text-tinta"><X className="size-3.5" /> Cerrar</Link></div>
                  {detalle}
                </div>
              </aside>
            )}
          </div>
          {datos.paginas > 1 && (
            <nav className="mt-4 flex items-center justify-between gap-2" aria-label="Páginas">
              {f.pagina > 1 ? <BotonLink href={pagina(f.pagina - 1)} variante="secundario">Anterior</BotonLink> : <span />}
              <span className="text-sm text-suave">Página {f.pagina} de {datos.paginas}</span>
              {f.pagina < datos.paginas ? <BotonLink href={pagina(f.pagina + 1)} variante="secundario">Siguiente</BotonLink> : <span />}
            </nav>
          )}
        </>
      )}
    </PaginaCompleta>
  );
}
