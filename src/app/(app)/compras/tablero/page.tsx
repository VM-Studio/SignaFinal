import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, FileSpreadsheet, PlusCircle, Upload } from "lucide-react";
import { exigirSesion } from "@/lib/auth/sesion";
import { puede } from "@/lib/permisos";
import { contadoresTablero, leerFiltros, opcionesTablero, ORDENES_TABLERO, tablero } from "@/lib/compras/tablero";
import { ordenPorId } from "@/lib/compras/consultas";
import { ESTADO_TABLERO } from "@/lib/compras/estadoTablero";
import { vistasDe } from "@/lib/vistas/consultas";
import { BotonLink, claseBoton } from "@/components/ui/boton";
import { Cifra, Titulo, Vacio } from "@/components/ui/basicos";
import { BarraFiltros } from "@/components/ui/barra-filtros";
import { ListaTablero, TablaTablero } from "@/components/compras/tablero";
import { DetalleOrden } from "@/components/compras/detalle-orden";
import { PestanasOrdenes } from "@/components/compras/pestanas-compras";

export const metadata: Metadata = { title: "Tablero de Compras" };

/**
 * TABLERO DE CONTROL de Compras: el de la planilla de Alejandra, sin copiar y pegar. Tabla a todo el
 * ancho con sus columnas; filtros combinables en la URL y vistas guardadas; "Próximos pasos" y
 * "Comentarios" se escriben en la misma tabla; al tocar una fila se abre la orden completa (a la
 * derecha en escritorio, abajo en el celular). Compras y el dueño editan; Administración mira.
 */
export default async function PaginaTablero({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const u = await exigirSesion();
  const sp = await searchParams;
  const f = leerFiltros(sp);
  const ver = typeof sp.ver === "string" ? sp.ver : null;
  const [datos, cont, op, vistas, orden] = await Promise.all([tablero(f), contadoresTablero(f), opcionesTablero(), vistasDe("tablero"), ver ? ordenPorId(ver) : null]);
  const gestiona = puede(u.rol, "materiales.gestionar");
  const qs = new URLSearchParams(Object.entries(sp).filter(([k, v]) => typeof v === "string" && k !== "ver" && k !== "pagina") as [string, string][]).toString();
  const pagina = (n: number) => `/compras/tablero?${new URLSearchParams({ ...Object.fromEntries(new URLSearchParams(qs)), ...(n > 1 ? { pagina: String(n) } : {}) }).toString()}`;
  const hayFiltros = qs.replace(/(^|&)orden=[^&]*/, "").length > 0;
  const detalle = orden ? <DetalleOrden oc={orden} editable={gestiona} autorizaPago={datos.autorizaPago} compacto /> : null;

  return (
    <div>
      <Titulo siempre detalle="Todas las órdenes de compra y pedidos especiales, con su estado y lo que falta."
        accion={
          <div className="flex flex-wrap gap-2">
            {gestiona && <BotonLink href="/compras/ordenes/nueva" icono={<PlusCircle />}>Nueva OC</BotonLink>}
            {gestiona && <BotonLink href="/compras/ordenes/nueva?tipo=PE" variante="secundario" icono={<PlusCircle />}>Nuevo PE</BotonLink>}
            <a href={`/api/compras/tablero/exportar${qs ? `?${qs}` : ""}`} className={claseBoton("secundario")}><FileSpreadsheet /> Exportar a Excel</a>
          </div>
        }>
        Tablero
      </Titulo>
      {gestiona && <PestanasOrdenes activa="tablero" />}

      <div className="mb-3 grid grid-cols-3 gap-2 lg:max-w-3xl lg:gap-3">
        <Link href="/compras/tablero?estado=PEDIR_AUTORIZACION"><Cifra etiqueta="Pedir autorización" valor={cont.pedir} tono={cont.pedir ? "aviso" : undefined} /></Link>
        <Link href="/compras/tablero?estado=ENCARGADO"><Cifra etiqueta="Encargado" valor={cont.encargado} /></Link>
        <Link href="/compras/tablero?estado=ENTREGADO&orden=fecha-desc"><Cifra etiqueta="Entregado este mes" valor={cont.entregadoMes} tono="ok" /></Link>
      </div>

      <BarraFiltros
        pantalla="tablero"
        vistas={vistas}
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

      {datos.total === 0 ? (
        hayFiltros ? (
          <Vacio icono={<ClipboardList className="size-10" />} titulo="Ninguna orden con esos filtros">Probá sacando alguno.</Vacio>
        ) : (
          <Vacio icono={<ClipboardList className="size-10" />} titulo="Todavía no hay órdenes" accion={gestiona ? <div className="flex flex-wrap justify-center gap-2"><BotonLink href="/compras/ordenes/nueva" icono={<PlusCircle />}>Crear la primera</BotonLink><BotonLink href="/compras/importar" variante="secundario" icono={<Upload />}>Importar desde Excel</BotonLink></div> : undefined}>
            Creá la primera o importá tu tablero desde Excel.
          </Vacio>
        )
      ) : (
        <>
          <p className="mb-2 text-[12px] text-suave">{datos.total === 1 ? "1 orden" : `${datos.total.toLocaleString("es-AR")} órdenes`}{datos.paginas > 1 ? ` · página ${f.pagina} de ${datos.paginas}` : ""}</p>
          <div className={orden ? "lg:grid lg:grid-cols-[minmax(0,1fr)_480px] lg:gap-4" : ""}>
            <div className="min-w-0">
              <TablaTablero filas={datos.filas} editable={gestiona} />
              <ListaTablero filas={datos.filas} editable={gestiona} detalle={detalle} />
            </div>
            {orden && (
              <aside className="@container hidden min-w-0 lg:block">
                <div className="sticky top-[72px] max-h-[calc(100dvh-96px)] overflow-y-auto rounded-[var(--radius-caja)] border border-linea bg-papel p-4">
                  <div className="mb-2 flex justify-end"><Link scroll={false} href={pagina(f.pagina)} className="text-[12px] font-medium text-suave hover:text-tinta">Cerrar</Link></div>
                  {detalle}
                </div>
              </aside>
            )}
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
  );
}
