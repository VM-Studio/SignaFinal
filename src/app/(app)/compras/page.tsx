import type { Metadata } from "next";
import Link from "next/link";
import { PlusCircle, ShoppingCart, X } from "lucide-react";
import { bandejaCompras, leerFiltrosBandeja, PESTANAS_BANDEJA, type PestanaBandeja } from "@/lib/materiales/consultas";
import { vistasDe } from "@/lib/vistas/consultas";
import { limiteDe } from "@/lib/pagina";
import { BotonLink } from "@/components/ui/boton";
import { PaginaCompleta, Segmentos, Titulo, Vacio } from "@/components/ui/basicos";
import { CargarMas } from "@/components/ui/cargar-mas";
import { BarraFiltros } from "@/components/ui/barra-filtros";
import { RestaurarLista } from "@/components/ui/volver";
import { BandejaCompras } from "@/components/materiales/lista-materiales";

export const metadata: Metadata = { title: "Pedidos de material" };

const VACIO: Record<PestanaBandeja, string> = {
  nuevos: "No hay pedidos nuevos",
  "en-compras": "No hay nada en Compras",
  todos: "No hay pedidos en manos de Compras",
};

/**
 * BANDEJA DE COMPRAS ("Pedidos de material", y la vista global del dueño): los documentos que llegaron
 * (Nuevos, sin abrir) y los que Compras está completando (En Compras). Arriba, "Con OC cargada" (ya traen
 * proveedor sugerido, importe o más de 3 celdas) y "Solo indicaciones"; cada fila dice qué falta. Abrir una
 * fila abre la plantilla (la primera vez, pasa a En Compras con Alejandra como responsable).
 */
export default async function PaginaCompras({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  // "?filtro=nuevos" (la franja negra del tablero) es la pestaña Nuevos.
  const p = typeof sp.p === "string" ? sp.p : sp.filtro === "nuevos" ? "nuevos" : undefined;
  const pestana: PestanaBandeja = p && p in PESTANAS_BANDEJA ? (p as PestanaBandeja) : "todos";
  const f = leerFiltrosBandeja(sp);
  const { limite, siguiente } = await limiteDe(typeof sp.n === "string" ? sp.n : undefined);
  const [d, vistas] = await Promise.all([bandejaCompras(pestana, f, limite), vistasDe("compras")]);
  const otros = Object.entries(sp).filter(([k, v]) => typeof v === "string" && !["p", "n", "filtro"].includes(k)) as [string, string][];
  const url = (cambios: Record<string, string | null>) => {
    const n = new URLSearchParams(otros);
    if (pestana !== "todos") n.set("p", pestana);
    for (const [k, v] of Object.entries(cambios)) {
      if (v == null) n.delete(k);
      else n.set(k, v);
    }
    const s = n.toString();
    return s ? `/compras?${s}` : "/compras";
  };
  const conFiltros = otros.length > 0;
  const chip = (valor: "oc" | "indicaciones", etiqueta: string, n: number) => {
    const activo = f.carga === valor;
    return (
      <Link href={url({ carga: activo ? null : valor })} scroll={false} aria-pressed={activo}
        className={`inline-flex h-9 items-center gap-2 rounded-full border px-3 text-[13px] font-medium ${activo ? "border-negro bg-negro text-white" : "border-linea bg-papel hover:border-linea-fuerte"}`}>
        {etiqueta} <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${activo ? "bg-white/15" : "bg-black/[0.05] text-suave"}`}>{n}</span>
      </Link>
    );
  };
  return (
    <PaginaCompleta>
      <RestaurarLista clave="pedidos" />
      <Titulo siempre accion={<BotonLink href="/compras/oc/nueva" icono={<PlusCircle />}>Nueva</BotonLink>}>Pedidos de material</Titulo>
      <Segmentos items={(Object.keys(PESTANAS_BANDEJA) as PestanaBandeja[]).map((k) => ({ href: url({ p: k === "todos" ? null : k }), etiqueta: PESTANAS_BANDEJA[k].titulo, cantidad: d.cuantos[k], activa: k === pestana }))} />
      <div className="mb-4 flex flex-wrap gap-2">
        {chip("oc", "Con OC cargada", d.chips.oc)}
        {chip("indicaciones", "Solo indicaciones", d.chips.indicaciones)}
      </div>
      <BarraFiltros
        pantalla="compras"
        vistas={vistas}
        conservar={["p"]}
        otrasClaves={["carga"]}
        buscador={{ placeholder: "Material, observaciones u obra" }}
        orden={{ opciones: [{ valor: "caducidad", etiqueta: "Caducidad más cercana" }, { valor: "caducidad-lejana", etiqueta: "Caducidad más lejana" }, { valor: "nuevos", etiqueta: "Más nuevos" }], porDefecto: "caducidad" }}
        filtros={[
          { tipo: "opciones", clave: "obra", etiqueta: "Obra", opciones: d.obras },
          { tipo: "opciones", clave: "sol", etiqueta: "Arquitecto/a", opciones: d.solicitantes },
          { tipo: "opciones", clave: "prioridad", etiqueta: "Prioridad", opciones: [{ valor: "URGENTE", etiqueta: "Urgente" }, { valor: "NORMAL", etiqueta: "Normal" }] },
          { tipo: "si", clave: "adjuntos", etiqueta: "Con adjuntos" },
        ]}
      />
      {d.filas.length === 0 ? (
        <Vacio llenar icono={<ShoppingCart className="size-10" />} titulo={conFiltros ? "Ningún pedido con esos filtros" : VACIO[pestana]}
          accion={conFiltros ? <BotonLink href={url(Object.fromEntries(otros.map(([k]) => [k, null])))} variante="secundario" icono={<X />}>Limpiar filtros</BotonLink> : undefined} />
      ) : (
        <BandejaCompras filas={d.filas} desde="pedidos" />
      )}
      {d.hayMas && <CargarMas href={`${url({})}${url({}).includes("?") ? "&" : "?"}n=${siguiente}`} />}
    </PaginaCompleta>
  );
}
