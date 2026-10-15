import Link from "next/link";
import { ArrowRight, ClipboardList, FileSpreadsheet, PlusCircle, X } from "lucide-react";
import { exigirSesion } from "@/lib/auth/sesion";
import { puede } from "@/lib/permisos";
import { contadoresTablero, leerFiltros, opcionesTablero, ORDENES_TABLERO, tablero } from "@/lib/compras/tablero";
import { cuantosNuevos } from "@/lib/materiales/consultas";
import { ESTADO_TABLERO, LEYENDA_TABLERO, PLANILLA_TABLERO } from "@/lib/compras/estadoTablero";
import { vistasDe } from "@/lib/vistas/consultas";
import { BotonLink, claseBoton } from "@/components/ui/boton";
import { PaginaCompleta, Titulo, Vacio } from "@/components/ui/basicos";
import { BarraFiltros } from "@/components/ui/barra-filtros";
import { RestaurarLista } from "@/components/ui/volver";
import { ListaTablero, TablaTablero } from "@/components/compras/tablero";

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
 * TABLERO DE CONTROL de Compras (/compras/tablero; lo primero que ve Compras, y el dueño y Administración).
 * Arriba, si hay pedidos nuevos sin tomar, la franja negra "4 pedidos nuevos esperan que los tomes"; cinco
 * tarjetas-filtro (Todas · Pedir autorización · Encargado · Listas para retirar · Entregado este mes) con la
 * leyenda de su planilla; la barra de filtros en una fila; la franja "Planilla de control COMPRAS" y la
 * planilla. Tocar una fila abre la orden en página completa (con "← Volver al tablero", que deja todo igual).
 */
export async function PaginaTablero({ sp, ruta }: { sp: Sp; ruta: string }) {
  const u = await exigirSesion();
  const f = leerFiltros(sp);
  const gestiona = puede(u.rol, "materiales.gestionar");
  const [datos, cont, op, vistas, nuevos] = await Promise.all([
    tablero(f), contadoresTablero(f), opcionesTablero(), vistasDe("tablero"), u.rol === "COMPRAS" ? cuantosNuevos() : Promise.resolve(0),
  ]);
  const plano = Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][];
  const qs = new URLSearchParams(plano.filter(([k]) => k !== "pagina")).toString();
  const url = (cambios: Record<string, string | null>) => {
    const n = new URLSearchParams(plano.filter(([k]) => k !== "pagina"));
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
  const nombre = u.rol === "COMPRAS" ? u.nombre.split(" ")[0] : "Alejandra";

  return (
    <PaginaCompleta>
      <RestaurarLista clave="tablero" />
      <Titulo siempre
        accion={
          <>
            <BotonLink href="/compras/oc/nueva" icono={<PlusCircle />}>Nueva</BotonLink>
            <a href={`/api/compras/tablero/exportar${qs ? `?${qs}` : ""}`} className={claseBoton("secundario")}><FileSpreadsheet /> Exportar a Excel</a>
          </>
        }>
        Tablero
      </Titulo>

      {nuevos > 0 && (
        <Link href="/compras?filtro=nuevos" className="-mx-4 mb-4 flex min-h-12 items-center justify-between gap-3 bg-negro px-4 text-[15px] font-medium text-white lg:mx-0 lg:mb-6 lg:rounded-[var(--radius-caja)] lg:px-5">
          <span>{nuevos === 1 ? "1 pedido nuevo espera que lo tomes" : `${nuevos} pedidos nuevos esperan que los tomes`}</span>
          <span className="flex shrink-0 items-center gap-1.5">Ver pedidos <ArrowRight className="size-4" /></span>
        </Link>
      )}

      <div className="mb-4 grid gap-6 lg:mb-6 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4">
          <TarjetaFiltro href={soloEstado(null)} etiqueta="Todas" valor={cont.todas} activa={!f.estado.length && !f.mes} />
          <TarjetaFiltro href={soloEstado("PEDIR_AUTORIZACION")} etiqueta="Pedir autorización" valor={cont.pedir} activa={estadoUnico === "PEDIR_AUTORIZACION" && !f.mes} />
          <TarjetaFiltro href={soloEstado("ENCARGADO")} etiqueta="Encargado" valor={cont.encargado} activa={estadoUnico === "ENCARGADO" && !f.mes} />
          <TarjetaFiltro href={soloEstado("HABILITADA")} etiqueta="Listas para retirar" valor={cont.habilitadas} activa={estadoUnico === "HABILITADA" && !f.mes} />
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

      {/* La franja de título de su planilla. */}
      <div className="-mx-4 flex h-9 shrink-0 items-center justify-between gap-3 border-y border-[#BFBFBF] bg-[#F2DCDB] px-4 lg:mx-0 lg:border-x lg:border-b-0">
        <p className="truncate text-[15px] italic">Planilla de control COMPRAS - {nombre}</p>
        <p className="shrink-0 text-[12px] text-[#595959] tabular-nums">{datos.total === 1 ? "1 orden" : `${datos.total.toLocaleString("es-AR")} órdenes`}{datos.paginas > 1 ? ` · página ${f.pagina} de ${datos.paginas}` : ""}</p>
      </div>

      {datos.total === 0 ? (
        <Vacio llenar icono={<ClipboardList className="size-10" />} titulo={hayFiltros ? "Ninguna orden con esos filtros" : "Todavía no hay órdenes"}
          accion={hayFiltros ? <BotonLink href={ruta} variante="secundario" icono={<X />}>Limpiar filtros</BotonLink> : undefined}>
          {hayFiltros ? "Probá sacando alguno." : gestiona ? "Lo que Compras envía a autorización aparece acá." : null}
        </Vacio>
      ) : (
        <>
          <TablaTablero filas={datos.filas} editable={gestiona} />
          <ListaTablero filas={datos.filas} editable={gestiona} />
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
