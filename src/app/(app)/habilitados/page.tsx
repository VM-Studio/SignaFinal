import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, PackageOpen, X } from "lucide-react";
import type { EstadoMaterialListo } from "@prisma/client";
import { habilitados } from "@/lib/materiales/consultas";
import { diasDesde, haceDias, LIMITES } from "@/lib/materiales/presentacion";
import { cuando, hora, peso } from "@/lib/formato";
import { limiteDe } from "@/lib/pagina";
import { vistasDe } from "@/lib/vistas/consultas";
import { BotonLink } from "@/components/ui/boton";
import { PaginaCompleta, Segmentos, Titulo, Vacio } from "@/components/ui/basicos";
import { BarraFiltros } from "@/components/ui/barra-filtros";
import { CargarMas } from "@/components/ui/cargar-mas";

export const metadata: Metadata = { title: "Habilitados" };

const PESTANAS: { clave: string; estado: EstadoMaterialListo; titulo: string; vacio: string }[] = [
  { clave: "listos", estado: "LISTO", titulo: "Sin retiro pedido", vacio: "No quedó nada listo sin retirar" },
  { clave: "retiro", estado: "RETIRO_PEDIDO", titulo: "Retiro pedido", vacio: "No hay retiros esperando chofer" },
  { clave: "camino", estado: "EN_CAMINO", titulo: "En camino", vacio: "No hay nada en camino" },
  { clave: "entregados", estado: "ENTREGADO", titulo: "Entregados", vacio: "Todavía no se entregó nada" },
];

const lista = (v: string | string[] | undefined) => (typeof v === "string" && v ? v.split(",").filter(Boolean).slice(0, 50) : []);

/**
 * Lo que Compras habilitó y qué pasó después: acá se ve lo que quedó colgado del lado de la obra. Pestañas
 * por paso (segmentos con contador), filtros en una fila (obra, proveedor, buscador) y la tabla a todo el
 * ancho; lo listo hace más de 3 días sin viaje, en rojo.
 */
export default async function PaginaHabilitados({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const pestana = PESTANAS.find((x) => x.clave === sp.p) ?? PESTANAS[0];
  const { limite, siguiente } = await limiteDe(typeof sp.n === "string" ? sp.n : undefined);
  const f = { obra: lista(sp.obra), prov: lista(sp.prov), q: typeof sp.q === "string" ? sp.q.trim().slice(0, 100) || undefined : undefined };
  const [{ filas, hayMas, cuantos, obras, proveedores }, vistas] = await Promise.all([habilitados(pestana.estado, limite, f), vistasDe("habilitados")]);
  const otros = Object.entries(sp).filter(([k, v]) => typeof v === "string" && !["p", "n"].includes(k)) as [string, string][];
  const url = (p: string | null, extra: [string, string][] = otros) => {
    const n = new URLSearchParams(extra);
    if (p && p !== "listos") n.set("p", p);
    const s = n.toString();
    return s ? `/habilitados?${s}` : "/habilitados";
  };
  const conFiltros = f.obra.length + f.prov.length > 0 || !!f.q;
  const detalle = (m: (typeof filas)[number]) =>
    m.estado === "LISTO" ? `Listo ${haceDias(m.habilitadoEn)}` :
    m.estado === "RETIRO_PEDIDO" ? `Viaje #${m.pedidoViaje?.numero} ${m.pedidoViaje?.tomadoPor ? `aceptado por ${m.pedidoViaje.tomadoPor.nombre}` : "esperando chofer"}` :
    m.estado === "EN_CAMINO" ? (m.modoEntrega === "ENTREGA_PROVEEDOR" ? "Lo trae el proveedor" : `${m.pedidoViaje?.tomadoPor?.nombre ?? "El chofer"} en camino${m.pedidoViaje?.viaje?.etaDestino ? ` · llega ${hora(m.pedidoViaje.viaje.etaDestino)}` : ""}`) :
    `Entregado ${cuando(m.entregadoEn)}`;
  const rojo = (m: (typeof filas)[number]) => m.estado === "LISTO" && diasDesde(m.habilitadoEn) >= LIMITES.sinRetirarDias;

  return (
    <PaginaCompleta>
      <Titulo siempre>Habilitados</Titulo>
      <Segmentos items={PESTANAS.map((x) => ({ href: url(x.clave), etiqueta: x.titulo, cantidad: cuantos[x.estado] ?? 0, activa: x.clave === pestana.clave }))} />
      <BarraFiltros
        pantalla="habilitados"
        vistas={vistas}
        conservar={["p"]}
        buscador={{ placeholder: "Qué se retira u OC" }}
        filtros={[
          { tipo: "opciones", clave: "obra", etiqueta: "Obra", opciones: obras },
          { tipo: "opciones", clave: "prov", etiqueta: "Proveedor", opciones: proveedores },
        ]}
      />
      {filas.length === 0 ? (
        <Vacio llenar icono={<PackageOpen className="size-10" />} titulo={conFiltros ? "Nada con esos filtros" : pestana.vacio}
          accion={conFiltros ? <BotonLink href={url(pestana.clave, [])} variante="secundario" icono={<X />}>Limpiar filtros</BotonLink> : undefined} />
      ) : (
        <>
          {/* Celular: filas de borde a borde */}
          <ul className="-mx-4 divide-y divide-linea border-y border-linea bg-papel lg:hidden">
            {filas.map((m) => (
              <li key={m.id} data-vivo-id={m.id}>
                <Link href={`/compras/${m.pedidoMaterial.id}`} className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-hover">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{m.descripcion}</p>
                    <p className="truncate text-sm text-suave">Obra {m.obra.nombre} · {m.proveedor.nombre}{m.pesoKg ? ` · hasta ${peso(m.pesoKg)}` : ""} · pidió {m.pedidoMaterial.solicitante.nombre}</p>
                    <p className={`text-sm ${rojo(m) ? "font-medium text-critico" : "text-suave"}`}>{detalle(m)}{rojo(m) ? " · nadie pidió el viaje" : ""}</p>
                  </div>
                  <ChevronRight aria-hidden className="size-5 shrink-0 text-apagado" />
                </Link>
              </li>
            ))}
          </ul>
          {/* Escritorio: tabla a todo el ancho, filas de 56 px */}
          <div className="hidden overflow-x-auto rounded-[var(--radius-caja)] border border-linea bg-papel lg:block">
            <table className="tabla tabla-56">
              <thead><tr><th>Qué se retira</th><th>Obra</th><th>Proveedor</th><th>OC</th><th className="num">Peso</th><th>Pidió</th><th>Qué pasó</th></tr></thead>
              <tbody>
                {filas.map((m) => (
                  <tr key={m.id} data-vivo-id={m.id}>
                    <td className="max-w-[360px]"><Link href={`/compras/${m.pedidoMaterial.id}`} className="block truncate font-medium hover:underline">{m.descripcion}</Link></td>
                    <td>Obra {m.obra.nombre}</td>
                    <td>{m.proveedor.nombre}</td>
                    <td className="text-suave tabular-nums">{m.ordenCompraNumero ?? "—"}</td>
                    <td className="num text-suave">{m.pesoKg ? peso(m.pesoKg) : "—"}</td>
                    <td>{m.pedidoMaterial.solicitante.nombre}</td>
                    <td className={rojo(m) ? "font-medium text-critico" : ""}>{detalle(m)}{rojo(m) ? " · nadie pidió el viaje" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {hayMas && <CargarMas href={`${url(pestana.clave)}${url(pestana.clave).includes("?") ? "&" : "?"}n=${siguiente}`} />}
    </PaginaCompleta>
  );
}
