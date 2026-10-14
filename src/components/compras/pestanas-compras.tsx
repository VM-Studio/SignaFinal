import { Pestanas } from "@/components/ui/basicos";

/** Las pestañas de "Órdenes" de Compras: Tablero · Órdenes · Importar. */
export function PestanasOrdenes({ activa, importar = true }: { activa: "tablero" | "ordenes" | "importar"; importar?: boolean }) {
  return (
    <Pestanas items={[
      { href: "/compras/tablero", etiqueta: "Tablero", activa: activa === "tablero" },
      { href: "/compras/ordenes", etiqueta: "Órdenes", activa: activa === "ordenes" },
      ...(importar ? [{ href: "/compras/importar", etiqueta: "Importar", activa: activa === "importar" }] : []),
    ]} />
  );
}
