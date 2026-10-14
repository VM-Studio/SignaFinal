import type { Metadata } from "next";
import Link from "next/link";
import { PlusCircle, ShoppingCart, Users } from "lucide-react";
import { colaComprasFiltrada, leerFiltrosCola } from "@/lib/materiales/consultas";
import { ESTADO_MATERIAL, PESTANAS_COMPRAS, type PestanaCompras } from "@/lib/materiales/presentacion";
import { vistasDe } from "@/lib/vistas/consultas";
import { limiteDe } from "@/lib/pagina";
import { BotonLink } from "@/components/ui/boton";
import { Pestanas, Titulo, Vacio } from "@/components/ui/basicos";
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
 * Cola de Compras (y vista global de pedidos de materiales del dueño): pestañas por paso, más la barra
 * de filtros (obra, solicitante, prioridad, estado, con adjuntos, buscador) y el orden por caducidad.
 * Caducidad hoy o vencida en rojo, mañana en ámbar. Panel con cuántos pidió cada uno (filtra al tocar).
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
  return (
    <div>
      <Titulo siempre accion={<BotonLink href="/compras/nuevo" icono={<PlusCircle />}>Nuevo pedido</BotonLink>}>Pedidos de material</Titulo>
      <Pestanas items={(Object.keys(PESTANAS_COMPRAS) as PestanaCompras[]).map((k) => ({ href: url({ p: k === "nuevos" ? null : k, estado: null }), etiqueta: `${PESTANAS_COMPRAS[k].titulo}${d.cuantos[k] ? ` (${d.cuantos[k]})` : ""}`, activa: !conEstado && k === pestana }))} />
      <BarraFiltros
        pantalla="compras"
        vistas={vistas}
        conservar={["p"]}
        buscador={{ placeholder: "Material, observaciones u OC" }}
        orden={{ opciones: [{ valor: "caducidad", etiqueta: "Caducidad más cercana" }, { valor: "caducidad-lejana", etiqueta: "Caducidad más lejana" }, { valor: "nuevos", etiqueta: "Más nuevos" }], porDefecto: "caducidad" }}
        filtros={[
          { tipo: "opciones", clave: "obra", etiqueta: "Obra", opciones: d.obras },
          { tipo: "opciones", clave: "sol", etiqueta: "Arquitecto/a", opciones: d.solicitantes },
          { tipo: "opciones", clave: "prioridad", etiqueta: "Prioridad", opciones: [{ valor: "URGENTE", etiqueta: "Urgente" }, { valor: "NORMAL", etiqueta: "Normal" }] },
          { tipo: "opciones", clave: "estado", etiqueta: "Estado", opciones: d.porEstado.map((e) => ({ valor: e.valor, etiqueta: ESTADO_MATERIAL[e.valor].titulo, cantidad: e.cantidad })) },
          { tipo: "si", clave: "adjuntos", etiqueta: "Con adjuntos" },
        ]}
      />
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div className="min-w-0">
          {d.filas.length === 0 ? <Vacio icono={<ShoppingCart className="size-10" />} titulo={conEstado || otros.length ? "Ningún pedido con esos filtros" : VACIO[pestana]} /> : <ColaMateriales filas={d.filas} />}
          {d.hayMas && <CargarMas href={`${url({})}${url({}).includes("?") ? "&" : "?"}n=${siguiente}`} />}
        </div>
        {d.porSolicitante.length > 0 && (
          <aside className="order-first min-w-0 lg:order-none">
            <p className="etiqueta mb-2 flex items-center gap-1.5"><Users className="size-3.5" /> Por quién pidió</p>
            <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
              {d.porSolicitante.map((x) => {
                const activo = f.sol.length === 1 && f.sol[0] === x.id;
                return (
                  <li key={x.id} className="shrink-0">
                    <Link href={url({ sol: activo ? null : x.id })} scroll={false} className={`flex items-center justify-between gap-3 rounded-[var(--radius-caja)] border px-3 py-2 text-sm ${activo ? "border-tinta bg-black/[0.04]" : "border-linea bg-papel hover:bg-hover"}`}>
                      <span className="truncate font-medium">{x.nombre}</span><span className="text-suave tabular-nums">{x.cantidad}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </aside>
        )}
      </div>
    </div>
  );
}
