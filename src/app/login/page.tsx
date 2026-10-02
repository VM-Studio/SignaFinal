import Image from "next/image";
import type { Metadata } from "next";
import { CONTRASENA_DEMO, modoDemo, usuariosDemo } from "@/lib/demo";
import { FranjaDemo } from "@/components/layout/franja-demo";
import { FormularioLogin } from "./formulario";

export const metadata: Metadata = { title: "Ingresar" };

export default async function PaginaLogin({ searchParams }: { searchParams: Promise<{ volver?: string }> }) {
  const { volver } = await searchParams;
  const demo = await usuariosDemo();
  return (
    <>
    {modoDemo() && <div className="pt-segura fixed inset-x-0 top-0 z-40 bg-aviso"><FranjaDemo /></div>}
    <main className="pt-segura pb-segura flex min-h-dvh flex-col items-center justify-center bg-negro px-5 py-10 text-white">
      <div className="w-full max-w-sm">
        <Image src="/signalogo.png" alt="SIGNA · Cultura en desarrollos" width={240} height={90} priority className="mx-auto mb-10 h-auto w-[220px]" />
        <FormularioLogin volver={volver} demo={demo ? { usuarios: demo, contrasena: CONTRASENA_DEMO } : null} />
      </div>
    </main>
    </>
  );
}
