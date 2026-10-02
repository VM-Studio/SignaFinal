"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Hoja } from "@/components/ui/hoja";
import { MensajeError } from "@/components/ui/campos";

/** Vuelve todos los datos al estado inicial de la demo. Cierra la sesión (los usuarios se recrean). */
export function ReiniciarDemo() {
  const [abierta, setAbierta] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <>
      <Boton variante="secundario" ancho icono={<RotateCcw className="size-5" />} onClick={() => setAbierta(true)}>Reiniciar datos de demo</Boton>
      <Hoja abierta={abierta} onCerrar={() => setAbierta(false)} titulo="Reiniciar la demo">
        <div className="flex flex-col gap-4">
          <p>Se borra todo lo cargado y vuelven los datos de demostración: pedidos, viajes, flota, herramientas y alertas. Vas a tener que volver a entrar.</p>
          <MensajeError>{error}</MensajeError>
          <Boton variante="peligro" ancho tamano="grande" cargando={enviando} onClick={async () => {
            setEnviando(true);
            try {
              const r = await fetch("/api/demo/reiniciar", { method: "POST" });
              if (!r.ok) throw new Error((await r.json()).error ?? "No se pudo reiniciar.");
              window.location.href = "/login";
            } catch (e) {
              setError(e instanceof Error ? e.message : "No se pudo reiniciar.");
              setEnviando(false);
            }
          }}>Reiniciar ahora</Boton>
        </div>
      </Hoja>
    </>
  );
}
