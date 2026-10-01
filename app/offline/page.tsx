import Image from "next/image";
import { CloudOff } from "lucide-react";

export const metadata = { title: "Sin señal" };

export default function PaginaSinSenal() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-negro px-6 text-center text-white">
      <Image src="/img/logo-640.png" alt="SIGNA" width={640} height={240} className="h-auto w-44" />
      <CloudOff className="size-10 text-white/70" />
      <h1 className="text-2xl font-bold">Sin señal</h1>
      <p className="max-w-sm text-white/70">
        Esta pantalla todavía no se había abierto en este teléfono. Las que ya usaste funcionan sin señal, y lo que cargues se guarda y se manda solo.
      </p>
      <a href="/inicio" className="mt-2 grid min-h-[52px] place-items-center rounded-[var(--radius-caja)] bg-white px-6 font-semibold text-negro">
        Probar de nuevo
      </a>
    </main>
  );
}
