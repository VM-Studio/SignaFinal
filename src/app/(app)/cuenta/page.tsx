import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import { exigirSesion } from "@/lib/auth/sesion";
import { FormularioSalir } from "@/components/layout/salir";
import { ROL } from "@/lib/etiquetas";
import { Tarjeta, Titulo } from "@/components/ui/basicos";
import { Boton } from "@/components/ui/boton";
import { modoDemo } from "@/lib/demo";
import { ReiniciarDemo } from "@/components/layout/reiniciar-demo";
import { EstadoPush } from "@/components/layout/estado-push";

export const metadata: Metadata = { title: "Mi cuenta" };

export default async function PaginaCuenta() {
  const u = await exigirSesion();
  return (
    <div className="mx-auto max-w-md">
      <Titulo>Mi cuenta</Titulo>
      <Tarjeta className="p-5">
        <p className="text-xl font-bold">{u.nombre}</p>
        <p className="text-suave">{ROL[u.rol]}</p>
        <p className="mt-1 text-suave">{u.email}</p>
      </Tarjeta>
      <p className="mt-3 text-sm text-suave">La sesión dura 30 días en este dispositivo.</p>
      <div className="mt-6"><EstadoPush /></div>
      {modoDemo() && (u.rol === "DIRECCION" || u.rol === "ADMINISTRACION") && (
        <div className="mt-6">
          <ReiniciarDemo />
        </div>
      )}
      <FormularioSalir className="mt-6">
        <Boton variante="peligro" ancho icono={<LogOut className="size-5" />}>Cerrar sesión</Boton>
      </FormularioSalir>
    </div>
  );
}
