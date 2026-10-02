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
    <main className="pt-segura pb-segura flex min-h-dvh flex-col items-center justify-center overflow-x-hidden bg-negro px-5 py-8 text-white">
      {/* public/inicio.png (1672 × 941) recortado alrededor del logo (~230 px de ancho). */}
      <div
        className="relative mb-8 aspect-[100/55] w-[min(76vw,300px)] shrink-0 overflow-hidden"
        // Bordes que se funden con el negro de la página (el fondo de la imagen no es negro puro).
        style={{ maskImage: "radial-gradient(ellipse 50% 50% at 50% 50%, #000 84%, transparent 100%)" }}
      >
        <Image
          src="/inicio.png"
          alt="SIGNA · Cultura en desarrollos"
          width={1672}
          height={941}
          priority
          sizes="(min-width: 400px) 460px, 116vw"
          className="absolute top-[-23.5%] left-[-27.3%] h-auto w-[151.5%] max-w-none"
        />
      </div>
      <div className="w-full max-w-sm">
        <FormularioLogin volver={volver} demo={demo ? { usuarios: demo, contrasena: CONTRASENA_DEMO } : null} />
      </div>
    </main>
    </>
  );
}
