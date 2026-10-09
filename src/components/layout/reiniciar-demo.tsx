"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Hoja } from "@/components/ui/hoja";
import { MensajeError } from "@/components/ui/campos";

/** Deja solo los datos base (usuarios, vehículos y herramientas en el depósito) y borra todo lo cargado. */
export function ReiniciarDemo() {
  const [abierta, setAbierta] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <>
      <Boton variante="secundario" ancho icono={<RotateCcw />} onClick={() => setAbierta(true)}>Dejar solo los datos base</Boton>
      <Hoja abierta={abierta} onCerrar={() => setAbierta(false)} titulo="Dejar solo los datos base">
        <div className="flex flex-col gap-4">
          <p>Se borra <b>todo lo cargado</b>: obras, proveedores, pedidos, viajes, materiales, avisos y la documentación de los vehículos. Quedan los usuarios, los seis vehículos y las herramientas en el depósito. No se puede deshacer.</p>
          <MensajeError>{error}</MensajeError>
          <Boton variante="peligro" ancho cargando={enviando} onClick={async () => {
            setEnviando(true);
            try {
              const r = await fetch("/api/demo/reiniciar", { method: "POST" });
              if (!r.ok) throw new Error((await r.json()).error ?? "No se pudo reiniciar.");
              window.location.href = "/inicio";
            } catch (e) {
              setError(e instanceof Error ? e.message : "No se pudo reiniciar.");
              setEnviando(false);
            }
          }}>Borrar todo y dejar la base</Boton>
        </div>
      </Hoja>
    </>
  );
}
