"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { entrar, type EstadoLogin } from "@/lib/acciones/auth";
import { Boton } from "@/components/ui/boton";
import { Campo, Entrada, MensajeError } from "@/components/ui/campos";

export function FormularioLogin({ volver }: { volver?: string }) {
  const [estado, accion, pendiente] = useActionState<EstadoLogin, FormData>(entrar, undefined);
  const [ver, setVer] = useState(false);

  return (
    <form action={accion} className="flex flex-col gap-4">
      {volver && <input type="hidden" name="volver" value={volver} />}
      <Campo etiqueta="Usuario" htmlFor="usuario">
        <Entrada id="usuario" name="usuario" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} required placeholder="Ej.: claudio" />
      </Campo>
      <Campo etiqueta="Contraseña" htmlFor="password">
        <div className="relative">
          <Entrada id="password" name="password" type={ver ? "text" : "password"} autoComplete="current-password" required className="pr-14" />
          <button type="button" onClick={() => setVer(!ver)} aria-label={ver ? "Ocultar contraseña" : "Mostrar contraseña"} className="absolute top-0 right-0 grid h-[52px] w-12 place-items-center text-suave">
            {ver ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        </div>
      </Campo>
      <MensajeError>{estado?.error}</MensajeError>
      <Boton type="submit" ancho tamano="grande" cargando={pendiente} icono={<LogIn className="size-5" />}>
        Entrar
      </Boton>
    </form>
  );
}
