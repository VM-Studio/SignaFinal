import Image from "next/image";
import type { Metadata } from "next";
import { CONTRASENA_DEMO, usuariosDemo } from "@/lib/demo";
import { FormularioLogin } from "./formulario";

export const metadata: Metadata = { title: "Ingresar" };

export default async function PaginaLogin({ searchParams }: { searchParams: Promise<{ volver?: string }> }) {
  const { volver } = await searchParams;
  const demo = await usuariosDemo();
  return (
    <main className="pt-segura pb-segura flex min-h-dvh flex-col items-center justify-center overflow-x-hidden bg-negro px-5 py-8 text-white">
      {/* Logo limpio con fondo transparente (public/marca, sale de scripts/logos.ts): nítido en cualquier pantalla. */}
      <Image
        src="/marca/signa-completo.png"
        alt="SIGNA · Cultura en desarrollos"
        width={1100}
        height={319}
        priority
        unoptimized
        className="mb-10 h-auto w-[min(72vw,280px)] shrink-0 select-none"
        draggable={false}
      />
      <div className="w-full max-w-sm">
        <FormularioLogin volver={volver} demo={demo ? { usuarios: demo, contrasena: CONTRASENA_DEMO } : null} />
      </div>
    </main>
  );
}
