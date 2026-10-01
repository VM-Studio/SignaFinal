import Image from "next/image";
import type { Metadata } from "next";
import { FormularioLogin } from "./formulario";

export const metadata: Metadata = { title: "Entrar" };

export default async function PaginaLogin({ searchParams }: { searchParams: Promise<{ volver?: string }> }) {
  const { volver } = await searchParams;
  return (
    <main className="flex min-h-dvh flex-col bg-negro lg:flex-row">
      <section className="pt-segura relative flex h-[38dvh] items-center justify-center overflow-hidden lg:h-auto lg:flex-1">
        <picture>
          <source media="(min-width: 1024px)" srcSet="/img/inicio-sistema.jpg" />
          <img src="/img/inicio-app.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-60 lg:opacity-100" />
        </picture>
        <Image src="/img/logo-640.png" alt="SIGNA · Cultura en desarrollos" width={640} height={240} priority className="relative h-auto w-56 lg:hidden" />
      </section>

      <section className="pb-segura flex flex-1 items-start justify-center rounded-t-3xl bg-fondo px-5 py-8 lg:max-w-[520px] lg:items-center lg:rounded-none lg:px-12">
        <div className="w-full max-w-sm">
          <h1 className="text-3xl font-bold tracking-tight">Entrar</h1>
          <p className="mt-1 mb-6 text-suave">Logística · Signa Desarrollos</p>
          <FormularioLogin volver={volver} />
        </div>
      </section>
    </main>
  );
}
