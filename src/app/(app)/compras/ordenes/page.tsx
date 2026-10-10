import type { Metadata } from "next";
import Link from "next/link";
import { Download, FileText } from "lucide-react";
import { ordenesCompra, type FiltroOC } from "@/lib/compras/consultas";
import { ESTADO_OC, METODO_PAGO } from "@/lib/compras/estados";
import { limiteDe } from "@/lib/pagina";
import { aFecha, fecha, plata } from "@/lib/formato";
import { Insignia, Titulo, Vacio } from "@/components/ui/basicos";
import { claseCampo } from "@/components/ui/campos";
import { claseBoton } from "@/components/ui/boton";
import { CargarMas } from "@/components/ui/cargar-mas";

export const metadata: Metadata = { title: "Órdenes de compra" };

/** Todas las órdenes de compra (Compras y Dirección): buscador por número, proveedor u obra; estado y fechas; CSV. */
export default async function PaginaOrdenes({ searchParams }: { searchParams: Promise<FiltroOC & { n?: string }> }) {
  const { n, ...f } = await searchParams;
  const { limite, siguiente } = await limiteDe(n);
  const { filas, hayMas } = await ordenesCompra(f, limite); // verifica materiales.gestionar
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]).toString();
  return (
    <div>
      <Titulo siempre detalle="Lo que va a recibir Lebane cuando exista la conexión." accion={<a href={`/api/compras/ordenes/exportar${qs ? `?${qs}` : ""}`} className={claseBoton("secundario")}><Download /> Exportar CSV</a>}>Órdenes de compra</Titulo>
      <form action="/compras/ordenes" className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-[minmax(0,1fr)_14rem_10rem_10rem_auto]">
        <input name="q" defaultValue={f.q} placeholder="Número, proveedor u obra" aria-label="Buscar" className={`${claseCampo} col-span-2 lg:col-span-1`} />
        <select name="estado" defaultValue={f.estado ?? ""} aria-label="Estado" className={claseCampo}>
          <option value="">Enviadas (todas)</option>
          {(["ESPERANDO_APROBACION", "APROBADA", "RECHAZADA", "ANULADA", "BORRADOR"] as const).map((e) => <option key={e} value={e}>{ESTADO_OC[e].titulo}</option>)}
        </select>
        <input type="date" name="desde" defaultValue={f.desde} aria-label="Desde" className={claseCampo} />
        <input type="date" name="hasta" defaultValue={f.hasta} aria-label="Hasta" className={claseCampo} />
        <button className={claseBoton("secundario")}>Filtrar</button>
      </form>
      {filas.length === 0 ? <Vacio icono={<FileText />} titulo="No hay órdenes de compra con esos filtros" /> : (
        <>
          <ul className="-mx-4 divide-y divide-linea border-y border-linea bg-papel lg:hidden">
            {filas.map((o) => (
              <li key={o.id}>
                <Link href={`/compras/${o.pedidoMaterialId}`} className="flex items-start justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="font-medium tabular-nums">{o.numero ?? "Borrador"}</p>
                    <p className="truncate text-sm text-suave">{o.proveedor ?? "—"} · Obra {o.obra}</p>
                    <p className="text-sm text-suave">{fecha(aFecha(o.fecha, "12:00"))}{o.total != null ? ` · ${plata(o.total)}` : ""}</p>
                  </div>
                  <Insignia tono={ESTADO_OC[o.estado].tono}>{ESTADO_OC[o.estado].titulo}</Insignia>
                </Link>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto rounded-[var(--radius-caja)] border border-linea bg-papel lg:block">
            <table className="tabla">
              <thead><tr><th>Número</th><th>Fecha</th><th>Proveedor</th><th>Obra</th><th>Pidió</th><th>Pago</th><th>Estado</th><th className="num">Total</th><th /></tr></thead>
              <tbody>
                {filas.map((o) => (
                  <tr key={o.id}>
                    <td className="font-medium tabular-nums"><Link href={`/compras/${o.pedidoMaterialId}`} className="hover:underline">{o.numero ?? "Borrador"}</Link></td>
                    <td className="text-suave">{fecha(aFecha(o.fecha, "12:00"))}</td>
                    <td>{o.proveedor ?? "—"}{o.sucursal && o.sucursal.nombre !== "Casa central" ? <span className="text-suave"> · {o.sucursal.nombre}</span> : null}</td>
                    <td>Obra {o.obra}</td>
                    <td className="text-suave">{o.solicitante}</td>
                    <td className="text-suave">{o.metodoPago ? METODO_PAGO[o.metodoPago] : "—"}</td>
                    <td><Insignia tono={ESTADO_OC[o.estado].tono}>{ESTADO_OC[o.estado].titulo}</Insignia></td>
                    <td className="num">{o.total != null ? plata(o.total) : "—"}</td>
                    <td className="w-px">{o.numero && <a href={`/api/oc/${o.id}/pdf${o.estado === "APROBADA" ? "?aprobada=1" : ""}`} target="_blank" rel="noopener" className={claseBoton("fantasma", "chico")} aria-label={`PDF de ${o.numero}`}><FileText /></a>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {hayMas && <CargarMas href={`/compras/ordenes?${qs ? `${qs}&` : ""}n=${siguiente}`} />}
    </div>
  );
}
