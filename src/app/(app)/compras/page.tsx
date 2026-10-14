import type { Metadata } from "next";
import { PlusCircle, ShoppingCart, X } from "lucide-react";
import { colaComprasFiltrada, leerFiltrosCola } from "@/lib/materiales/consultas";
import { ESTADO_MATERIAL, PESTANAS_COMPRAS, type PestanaCompras } from "@/lib/materiales/presentacion";
import { vistasDe } from "@/lib/vistas/consultas";
import { limiteDe } from "@/lib/pagina";
import { BotonLink } from "@/components/ui/boton";
import { PaginaCompleta, Segmentos, Titulo, Vacio } from "@/components/ui/basicos";
import { CargarMas } from "@/components/ui/cargar-mas";
import { BarraFiltros } from "@/components/ui/barra-filtros";
import { ColaMateriales } from "@/components/materiales/lista-materiales";

export const metadata: Metadata = { title: "Pedidos de material" };

const VACIO: Record<PestanaCompras, string> = {
  nuevos: "No hay pedidos nuevos",
  "en-compra": "No hay nada en compra",
  esperando: "Nada espera la aprobación del dueño",
  aprobados: "No hay aprobados esperando al proveedor",
  listos: "No hay nada habilitado en curso",
};

/**
 * Cola de Compras (y vista global de pedidos de materiales del dueño): pestañas por paso como barra de
 * segmentos con su contador, la barra de filtros en una fila (obra, arquitecto/a con cuántos pidió cada
 * uno, prioridad, estado, con adjuntos, buscador) y el orden por caducidad. La lista es una tabla a todo
 * el ancho; caducidad hoy o vencida en rojo, mañana en ámbar.
 */
export default async function PaginaCompras({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const p = typeof sp.p === "string" ? sp.p : undefined;
  const pestana: PestanaCompras = p && p in PESTANAS_COMPRAS ? (p as PestanaCompras) : "nuevos";
  const f = leerFiltrosCola(sp);
  const { limite, siguiente } = await limiteDe(typeof sp.n === "string" ? sp.n : undefined);
  const [d, vistas] = await Promise.all([colaComprasFiltrada(pestana, f, limite), vistasDe("compras")]);
  const otros = Object.entries(sp).filter(([k, v]) => typeof v === "string" && !["p", "n"].includes(k)) as [string, string][];
  const url = (cambios: Record<string, string | null>) => {
    const n = new URLSearchParams(otros);
    if (pestana !== "nuevos") n.set("p", pestana);
    for (const [k, v] of Object.entries(cambios)) {
      if (v == null) n.delete(k);
      else n.set(k, v);
    }
    const s = n.toString();
    return s ? `/compras?${s}` : "/compras";
  };
  const conEstado = f.estado.length > 0;
  const cuantosPidio = new Map(d.porSolicitante.map((x) => [x.id, x.cantidad]));
  const conFiltros = conEstado || otros.length > 0;
  return (
    <PaginaCompleta>
      <Titulo siempre accion={<BotonLink href="/compras/nuevo" icono={<PlusCircle />}>Nuevo pedido</BotonLink>}>Pedidos de material</Titulo>
      <Segmentos items={(Object.keys(PESTANAS_COMPRAS) as PestanaCompras[]).map((k) => ({ href: url({ p: k === "nuevos" ? null : k, estado: null }), etiqueta: PESTANAS_COMPRAS[k].titulo, cantidad: d.cuantos[k], activa: !conEstado && k === pestana }))} />
      <BarraFiltros
        pantalla="compras"
        vistas={vistas}
        conservar={["p"]}
        buscador={{ placeholder: "Material, observaciones u OC" }}
        orden={{ opciones: [{ valor: "caducidad", etiqueta: "Caducidad más cercana" }, { valor: "caducidad-lejana", etiqueta: "Caducidad más lejana" }, { valor: "nuevos", etiqueta: "Más nuevos" }], porDefecto: "caducidad" }}
        filtros={[
          { tipo: "opciones", clave: "obra", etiqueta: "Obra", opciones: d.obras },
          { tipo: "opciones", clave: "sol", etiqueta: "Arquitecto/a", opciones: d.solicitantes.map((x) => ({ ...x, cantidad: cuantosPidio.get(x.valor) })) },
          { tipo: "opciones", clave: "prioridad", etiqueta: "Prioridad", opciones: [{ valor: "URGENTE", etiqueta: "Urgente" }, { valor: "NORMAL", etiqueta: "Normal" }] },
          { tipo: "opciones", clave: "estado", etiqueta: "Estado", opciones: d.porEstado.map((e) => ({ valor: e.valor, etiqueta: ESTADO_MATERIAL[e.valor].titulo, cantidad: e.cantidad })) },
          { tipo: "si", clave: "adjuntos", etiqueta: "Con adjuntos" },
        ]}
      />
      {d.filas.length === 0 ? (
        <Vacio llenar icono={<ShoppingCart className="size-10" />} titulo={conFiltros ? "Ningún pedido con esos filtros" : VACIO[pestana]}
          accion={conFiltros ? <BotonLink href={url({ ...Object.fromEntries(otros.map(([k]) => [k, null])), estado: null })} variante="secundario" icono={<X />}>Limpiar filtros</BotonLink> : undefined} />
      ) : (
        <ColaMateriales filas={d.filas} />
      )}
      {d.hayMas && <CargarMas href={`${url({})}${url({}).includes("?") ? "&" : "?"}n=${siguiente}`} />}
    </PaginaCompleta>
  );
}
