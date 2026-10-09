import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, PackageOpen } from "lucide-react";
import type { EstadoMaterialListo } from "@prisma/client";
import { habilitados } from "@/lib/materiales/consultas";
import { diasDesde, haceDias, LIMITES } from "@/lib/materiales/presentacion";
import { cuando, hora, peso } from "@/lib/formato";
import { limiteDe } from "@/lib/pagina";
import { Pestanas, Titulo, Vacio } from "@/components/ui/basicos";
import { CargarMas } from "@/components/ui/cargar-mas";

export const metadata: Metadata = { title: "Habilitados" };

const PESTANAS: { clave: string; estado: EstadoMaterialListo; titulo: string; vacio: string }[] = [
  { clave: "listos", estado: "LISTO", titulo: "Sin retiro pedido", vacio: "No quedó nada listo sin retirar" },
  { clave: "retiro", estado: "RETIRO_PEDIDO", titulo: "Retiro pedido", vacio: "No hay retiros esperando chofer" },
  { clave: "camino", estado: "EN_CAMINO", titulo: "En camino", vacio: "No hay nada en camino" },
  { clave: "entregados", estado: "ENTREGADO", titulo: "Entregados", vacio: "Todavía no se entregó nada" },
];

/** Lo que Compras habilitó y qué pasó después: acá se ve lo que quedó colgado del lado de la obra. */
export default async function PaginaHabilitados({ searchParams }: { searchParams: Promise<{ p?: string; n?: string }> }) {
  const { p, n } = await searchParams;
  const pestana = PESTANAS.find((x) => x.clave === p) ?? PESTANAS[0];
  const { limite, siguiente } = await limiteDe(n);
  const { filas, hayMas, cuantos } = await habilitados(pestana.estado, limite);
  return (
    <div className="mx-auto max-w-3xl">
      <Titulo>Habilitados para retirar</Titulo>
      <Pestanas items={PESTANAS.map((x) => ({ href: x.clave === "listos" ? "/habilitados" : `/habilitados?p=${x.clave}`, etiqueta: `${x.titulo}${cuantos[x.estado] ? ` (${cuantos[x.estado]})` : ""}`, activa: x.clave === pestana.clave }))} />
      {filas.length === 0 ? (
        <Vacio icono={<PackageOpen className="size-10" />} titulo={pestana.vacio} />
      ) : (
        <ul className="divide-y divide-linea overflow-hidden rounded-[var(--radius-caja)] border border-linea bg-papel">
          {filas.map((m) => {
            const rojo = m.estado === "LISTO" && diasDesde(m.habilitadoEn) >= LIMITES.sinRetirarDias;
            const detalle =
              m.estado === "LISTO" ? `Listo ${haceDias(m.habilitadoEn)}` :
              m.estado === "RETIRO_PEDIDO" ? `Viaje #${m.pedidoViaje?.numero} ${m.pedidoViaje?.tomadoPor ? `aceptado por ${m.pedidoViaje.tomadoPor.nombre}` : "esperando chofer"}` :
              m.estado === "EN_CAMINO" ? (m.modoEntrega === "ENTREGA_PROVEEDOR" ? "Lo trae el proveedor" : `${m.pedidoViaje?.tomadoPor?.nombre ?? "El chofer"} en camino${m.pedidoViaje?.viaje?.etaDestino ? ` · llega ${hora(m.pedidoViaje.viaje.etaDestino)}` : ""}`) :
              `Entregado ${cuando(m.entregadoEn)}`;
            return (
              <li key={m.id}>
                <Link href={`/compras/${m.pedidoMaterial.id}`} className={`flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-fondo ${rojo ? "border-l-4 border-critico" : ""}`}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{m.descripcion}</p>
                    <p className="truncate text-sm text-suave">Obra {m.obra.nombre} · {m.proveedor.nombre}{m.pesoKg ? ` · hasta ${peso(m.pesoKg)}` : ""} · pidió {m.pedidoMaterial.solicitante.nombre}</p>
                    <p className={`text-sm ${rojo ? "font-semibold text-critico" : "text-suave"}`}>{detalle}{rojo ? " · nadie pidió el viaje" : ""}</p>
                  </div>
                  <ChevronRight aria-hidden className="size-5 shrink-0 text-apagado" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {hayMas && <CargarMas href={`/habilitados?${pestana.clave !== "listos" ? `p=${pestana.clave}&` : ""}n=${siguiente}`} />}
    </div>
  );
}
