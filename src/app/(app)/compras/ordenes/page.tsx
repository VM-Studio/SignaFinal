import type { Metadata } from "next";
import Link from "next/link";
import { FileText, PlusCircle } from "lucide-react";
import { ordenesCompra, type OCPlana } from "@/lib/compras/consultas";
import { ESTADO_OC, importeTexto } from "@/lib/compras/estados";
import { ESTADO_TABLERO } from "@/lib/compras/estadoTablero";
import { vistasDe } from "@/lib/vistas/consultas";
import { limiteDe } from "@/lib/pagina";
import { BotonLink } from "@/components/ui/boton";
import { Insignia, Subtitulo, Titulo, Vacio } from "@/components/ui/basicos";
import { CargarMas } from "@/components/ui/cargar-mas";
import { BarraFiltros } from "@/components/ui/barra-filtros";
import { PestanasOrdenes } from "@/components/compras/pestanas-compras";

export const metadata: Metadata = { title: "Órdenes" };

const fecha = (s: string) => s.split("-").reverse().join("/");

function Fila({ o }: { o: OCPlana }) {
  const estado = o.estadoTablero ? ESTADO_TABLERO[o.estadoTablero] : ESTADO_OC[o.estado];
  return (
    <li data-vivo-id={o.id}>
      <Link href={`/compras/ordenes/${o.id}`} className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-hover lg:min-h-11">
        <span className="w-24 shrink-0 font-semibold tabular-nums">{o.numero ? `${o.tipo} ${o.numeroCorto}` : o.tipo}{o.versionAprobacion > 1 ? ` v${o.versionAprobacion}` : ""}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{o.detallePedido?.split("\n")[0] || o.renglones[0]?.descripcion || "Sin detalle todavía"}</span>
          <span className="block truncate text-[13px] text-suave">{[o.obra, o.solicitadoPor, o.proveedor ?? o.proveedorSugerido, fecha(o.fecha)].filter((x) => x && x !== "—").join(" · ")}</span>
        </span>
        <span className="hidden text-right tabular-nums sm:block">{o.importe != null || o.importeAConfirmar ? importeTexto(o.importe, o.moneda, o.importeAConfirmar) : ""}</span>
        <Insignia tono={estado.tono}>{estado.titulo}</Insignia>
      </Link>
    </li>
  );
}

/**
 * ÓRDENES (el módulo donde quedan guardadas las OC y PE): los borradores arriba para retomarlos, y
 * después todas, con buscador por número, proveedor u obra. Cada una se abre en la plantilla.
 */
export default async function PaginaOrdenes({ searchParams }: { searchParams: Promise<{ q?: string; tipo?: string; n?: string }> }) {
  const { q, tipo, n } = await searchParams;
  const { limite, siguiente } = await limiteDe(n);
  const [{ borradores, filas, hayMas }, vistas] = await Promise.all([ordenesCompra({ q, tipo }, limite), vistasDe("ordenes")]);
  const qs = new URLSearchParams({ ...(q ? { q } : {}), ...(tipo ? { tipo } : {}) }).toString();
  return (
    <div>
      <Titulo siempre detalle="Todas las órdenes de compra y pedidos especiales, con sus versiones. Lo que va a recibir Lebane cuando exista la conexión."
        accion={<div className="flex flex-wrap gap-2"><BotonLink href="/compras/ordenes/nueva" icono={<PlusCircle />}>Nueva OC</BotonLink><BotonLink href="/compras/ordenes/nueva?tipo=PE" variante="secundario" icono={<PlusCircle />}>Nuevo PE</BotonLink></div>}>
        Órdenes
      </Titulo>
      <PestanasOrdenes activa="ordenes" />
      <BarraFiltros pantalla="ordenes" vistas={vistas} buscador={{ placeholder: "Número, proveedor, obra o material" }}
        filtros={[{ tipo: "opciones", clave: "tipo", etiqueta: "Tipo", multiple: false, opciones: [{ valor: "OC", etiqueta: "OC · orden de compra" }, { valor: "PE", etiqueta: "PE · pedido especial" }] }]} />
      {borradores.length > 0 && (
        <section className="mb-6">
          <Subtitulo>Borradores ({borradores.length})</Subtitulo>
          <ul className="divide-y divide-linea rounded-[var(--radius-caja)] border border-linea bg-papel">{borradores.map((o) => <Fila key={o.id} o={o} />)}</ul>
        </section>
      )}
      <Subtitulo>Enviadas, autorizadas e importadas</Subtitulo>
      {filas.length === 0 ? (
        <Vacio icono={<FileText className="size-10" />} titulo={q || tipo ? "No hay órdenes con esa búsqueda" : "Todavía no hay órdenes"}>{q || tipo ? "Probá con otra." : "Creá la primera con “Nueva OC”."}</Vacio>
      ) : (
        <ul className="divide-y divide-linea rounded-[var(--radius-caja)] border border-linea bg-papel">{filas.map((o) => <Fila key={o.id} o={o} />)}</ul>
      )}
      {hayMas && <CargarMas href={`/compras/ordenes?${qs}${qs ? "&" : ""}n=${siguiente}`} />}
    </div>
  );
}
