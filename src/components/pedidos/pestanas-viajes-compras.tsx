import { Segmentos } from "@/components/ui/basicos";

/** Viajes de Compras: Coordinar viaje · Solicitudes, como barra de segmentos. */
export function PestanasViajesCompras({ activa, pendientes }: { activa: "coordinar" | "solicitudes"; pendientes?: number }) {
  return (
    <Segmentos items={[
      { href: "/compras/viajes", etiqueta: "Coordinar viaje", activa: activa === "coordinar" },
      { href: "/compras/viajes/solicitudes", etiqueta: "Solicitudes", cantidad: pendientes, activa: activa === "solicitudes" },
    ]} />
  );
}
