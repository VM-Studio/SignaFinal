"use client";

import { useState, useTransition } from "react";
import { LogOut } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Campo, Entrada, MensajeError } from "@/components/ui/campos";
import { useAviso } from "@/components/ui/avisos";
import { cambiarMiClave } from "@/lib/acciones/usuarios";
import { salir } from "@/lib/acciones/auth";

export function CambiarClave() {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [error, setError] = useState<string>();
  const [pendiente, iniciar] = useTransition();
  const aviso = useAviso();
  return (
    <div className="flex flex-col gap-3">
      <Campo etiqueta="Contraseña actual" htmlFor="actual"><Entrada id="actual" type="password" autoComplete="current-password" value={actual} onChange={(e) => setActual(e.target.value)} /></Campo>
      <Campo etiqueta="Nueva (mínimo 8)" htmlFor="nueva"><Entrada id="nueva" type="password" autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} /></Campo>
      <MensajeError>{error}</MensajeError>
      <Boton
        variante="secundario"
        disabled={!actual || nueva.length < 8}
        cargando={pendiente}
        onClick={() =>
          iniciar(async () => {
            const r = await cambiarMiClave(actual, nueva);
            if (!r.ok) return setError(r.error);
            setError(undefined);
            setActual("");
            setNueva("");
            aviso({ mensaje: "Contraseña cambiada." });
          })
        }
      >
        Cambiar contraseña
      </Boton>
    </div>
  );
}

/** Al salir se borran las pantallas guardadas en el teléfono (pueden ser de otra persona). */
export function Salir() {
  const [pendiente, iniciar] = useTransition();
  return (
    <Boton
      variante="peligro"
      ancho
      cargando={pendiente}
      icono={<LogOut className="size-5" />}
      onClick={() =>
        iniciar(async () => {
          try {
            const claves = await caches.keys();
            await Promise.all(claves.filter((k) => k.includes("pantallas")).map((k) => caches.delete(k)));
            sessionStorage.clear();
          } catch {}
          await salir();
        })
      }
    >
      Cerrar sesión
    </Boton>
  );
}
