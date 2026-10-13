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
    <div className="max-w-xl">
      <Titulo>Mi cuenta</Titulo>
      <Tarjeta className="p-5">
        <p className="text-xl font-semibold">{u.nombre}</p>
        <p className="text-suave">{ROL[u.rol]}</p>
        <p className="mt-1 text-suave">{u.email}</p>
      </Tarjeta>
      <p className="mt-3 text-sm text-suave">La sesión dura 30 días en este dispositivo.</p>
      <div className="mt-6"><EstadoPush /></div>
      {(u.rol === "CHOFER" || u.rol === "DIRECCION") && (
        <Tarjeta className="mt-4 p-5 text-sm">
          <p className="font-semibold">Avisos del viaje con botones</p>
          <p className="mt-1 text-suave">
            Cuando el GPS detecta que llegaste o saliste de una parada, te llega un aviso aunque estés en Google Maps.
          </p>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-suave">
            <li><span className="font-medium text-tinta">Android:</span> el aviso trae los botones <b>Sí, llegué / Todavía no</b> (o <b>Sí, salí / Sigo acá</b>). Se responde ahí mismo, sin abrir Signa, y se le avisa al que pidió.</li>
            <li><span className="font-medium text-tinta">iPhone:</span> el iPhone no muestra botones en los avisos de una app web. Tocá el aviso: se abre el modo conducción con el deslizador ya en verde, listo para confirmar.</li>
          </ul>
        </Tarjeta>
      )}
      {modoDemo() && (u.rol === "DIRECCION" || u.rol === "ADMINISTRACION") && (
        <div className="mt-6">
          <ReiniciarDemo />
        </div>
      )}
      <FormularioSalir className="mt-6">
        <Boton variante="peligro" ancho icono={<LogOut />}>Cerrar sesión</Boton>
      </FormularioSalir>
    </div>
  );
}
