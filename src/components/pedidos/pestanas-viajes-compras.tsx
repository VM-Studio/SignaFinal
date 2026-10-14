import { Pestanas } from "@/components/ui/basicos";

/** Viajes de Compras: Coordinar viaje · Solicitudes. */
export function PestanasViajesCompras({ activa }: { activa: "coordinar" | "solicitudes" }) {
  return (
    <Pestanas items={[
      { href: "/compras/viajes", etiqueta: "Coordinar viaje", activa: activa === "coordinar" },
      { href: "/compras/viajes/solicitudes", etiqueta: "Solicitudes", activa: activa === "solicitudes" },
    ]} />
  );
}
