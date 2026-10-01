import type { Metadata } from "next";
import { requerirUsuario } from "@/lib/auth/usuario-actual";
import { ROL } from "@/lib/etiquetas";
import { Tarjeta, Titulo, Subtitulo } from "@/components/ui/basicos";
import { CambiarClave, Salir } from "./cliente";

export const metadata: Metadata = { title: "Mi cuenta" };

export default async function PaginaCuenta() {
  const u = await requerirUsuario();
  return (
    <div className="mx-auto max-w-md">
      <Titulo>Mi cuenta</Titulo>
      <Tarjeta className="p-4">
        <p className="text-xl font-bold">{u.nombre}</p>
        <p className="text-suave">{ROL[u.rol]} · usuario {u.usuario}</p>
      </Tarjeta>
      <Subtitulo>Cambiar contraseña</Subtitulo>
      <CambiarClave />
      <div className="mt-8">
        <Salir />
      </div>
    </div>
  );
}
