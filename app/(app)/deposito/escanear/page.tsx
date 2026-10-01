import type { Metadata } from "next";
import { requerirUsuario } from "@/lib/auth/usuario-actual";
import { Escaner } from "./escaner";

export const metadata: Metadata = { title: "Escanear" };

export default async function PaginaEscanear() {
  await requerirUsuario("deposito.ver");
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-1 text-2xl font-bold">Escanear</h1>
      <p className="mb-4 text-suave">Apuntá la cámara al QR de la máquina o herramienta.</p>
      <Escaner />
    </div>
  );
}
