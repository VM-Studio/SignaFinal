import type { Metadata } from "next";
import Link from "next/link";
import { Receipt } from "lucide-react";
import { paraFacturar } from "@/lib/materiales/consultas";
import { textosDe } from "@/lib/compras/celdas";
import { nombreDoc, ESTADO_DOC, ESTADO_FACTURACION, ESTADO_PAGO } from "@/lib/compras/documento";
import { vistasDe } from "@/lib/vistas/consultas";
import { limiteDe } from "@/lib/pagina";
import { Insignia, PaginaCompleta, Segmentos, Titulo, Vacio } from "@/components/ui/basicos";
import { BarraFiltros } from "@/components/ui/barra-filtros";
import { CargarMas } from "@/components/ui/cargar-mas";
import { RestaurarLista } from "@/components/ui/volver";
import { FilaEnlace } from "@/components/ui/fila-enlace";

export const metadata: Metadata = { title: "Facturación" };

/**
 * FACTURACIÓN (Administración): las órdenes autorizadas en adelante con la factura o el pago pendientes, por
 * fecha. Cada una abre la misma plantilla, donde completa la sección 3 (factura, forma y condición de pago,
 * el archivo) y la 4 (pedir la autorización del pago y la fecha de pago).
 */
export default async function PaginaFacturacion({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const pendiente = sp.p === "factura" ? "factura" : sp.p === "pago" ? "pago" : null;
  const obra = typeof sp.obra === "string" && sp.obra ? sp.obra.split(",") : [];
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) || undefined : undefined;
  const { limite, siguiente } = await limiteDe(typeof sp.n === "string" ? sp.n : undefined);
  const [d, vistas] = await Promise.all([paraFacturar({ q, obra, pendiente }, limite), vistasDe("facturacion")]);
  const url = (p: string | null) => {
    const n = new URLSearchParams(Object.entries(sp).filter(([k, v]) => typeof v === "string" && k !== "p" && k !== "n") as [string, string][]);
    if (p) n.set("p", p);
    const s = n.toString();
    return s ? `/compras/facturacion?${s}` : "/compras/facturacion";
  };
  return (
    <PaginaCompleta>
      <RestaurarLista clave="facturacion" />
      <Titulo siempre>Facturación</Titulo>
      <Segmentos items={[
        { href: url(null), etiqueta: "Todo lo pendiente", activa: !pendiente },
        { href: url("factura"), etiqueta: "Falta la factura", activa: pendiente === "factura" },
        { href: url("pago"), etiqueta: "Falta el pago", activa: pendiente === "pago" },
      ]} />
      <BarraFiltros pantalla="facturacion" vistas={vistas} conservar={["p"]} buscador={{ placeholder: "Número, factura, proveedor o material" }}
        filtros={[{ tipo: "opciones", clave: "obra", etiqueta: "Obra", opciones: d.obras }]} />
      {d.filas.length === 0 ? (
        <Vacio llenar icono={<Receipt className="size-10" />} titulo="Nada pendiente de facturar o pagar" />
      ) : (
        <>
          <ul className="-mx-4 divide-y divide-linea border-y border-linea bg-papel lg:hidden">
            {d.filas.map((o) => {
              const t = textosDe(o);
              return (
                <li key={o.id} data-vivo-id={o.id}>
                  <Link href={`/compras/oc/${o.id}?desde=facturacion`} className="flex flex-col gap-1 px-4 py-3">
                    <span className="flex items-center gap-2"><b className="font-semibold tabular-nums">{nombreDoc(o)}</b><span className="text-sm text-suave">{t.proveedorFinal}</span><span className="ml-auto font-semibold tabular-nums">{t.importe}</span></span>
                    <span className="text-sm text-suave">Obra {t.obra} · {ESTADO_FACTURACION[o.estadoFacturacion].titulo} · {ESTADO_PAGO[o.estadoPago].titulo}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="hidden overflow-x-auto rounded-[var(--radius-caja)] border border-linea bg-papel lg:block">
            <table className="tabla tabla-56">
              <thead><tr><th>N°</th><th>Proveedor</th><th>Obra</th><th>Autorizada</th><th className="num">Importe</th><th>Factura</th><th>Pago</th><th>Estado</th></tr></thead>
              <tbody>
                {d.filas.map((o) => {
                  const t = textosDe(o);
                  const fa = ESTADO_FACTURACION[o.estadoFacturacion];
                  const pa = ESTADO_PAGO[o.estadoPago];
                  return (
                    <FilaEnlace key={o.id} href={`/compras/oc/${o.id}?desde=facturacion`} clave="facturacion" data-vivo-id={o.id}>
                      <td className="font-semibold tabular-nums">{nombreDoc(o)}</td>
                      <td>{t.proveedorFinal || "—"}</td>
                      <td>Obra {t.obra}</td>
                      <td className="text-suave tabular-nums">{o.aprobadaEn ? new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "numeric", month: "numeric", year: "numeric" }).format(o.aprobadaEn) : "—"}</td>
                      <td className="num font-medium">{t.importe || "—"}</td>
                      <td><span className="rounded px-1.5 py-0.5 text-[12px] font-medium" style={{ background: fa.fondo, color: fa.texto }}>{t.facturaN ? `${fa.titulo} · ${t.facturaN}` : fa.titulo}</span></td>
                      <td><span className="rounded px-1.5 py-0.5 text-[12px] font-medium" style={{ background: pa.fondo, color: pa.texto }}>{o.pagoSolicitadoEn && o.estadoPago === "PENDIENTE" ? "Pedido al dueño" : pa.titulo}</span></td>
                      <td><Insignia tono={ESTADO_DOC[o.estado].tono}>{ESTADO_DOC[o.estado].titulo}</Insignia></td>
                    </FilaEnlace>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      {d.hayMas && <CargarMas href={`${url(pendiente)}${url(pendiente).includes("?") ? "&" : "?"}n=${siguiente}`} />}
    </PaginaCompleta>
  );
}
