"use client";

import dynamic from "next/dynamic";

const MapaPin = dynamic(() => import("./mapa-pin"), { ssr: false, loading: () => <div className="h-full w-full bg-fondo" /> });

/** Mapa chico de solo lectura con un pin (tarjetas de sucursal, depósitos, sedes). */
export function MapaPunto({ lat, lng, alto = "h-36" }: { lat: number; lng: number; alto?: string }) {
  return (
    <div className={`relative isolate ${alto} overflow-hidden rounded-md border border-linea`}>
      <MapaPin punto={{ lat, lng }} soloVer />
    </div>
  );
}
