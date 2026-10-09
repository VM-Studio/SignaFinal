import Image from "next/image";

export const metadata = { title: "Sin conexión" };
export const dynamic = "force-static";

/** La muestra el service worker cuando no hay señal y la pantalla nunca se abrió en este teléfono. */
export default function SinConexion() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-negro px-6 text-center text-white">
      <Image src="/signalogo.png" alt="Signa" width={180} height={68} priority className="h-auto w-[180px]" />
      <h1 className="text-2xl font-semibold">Sin conexión</h1>
      <p className="max-w-sm text-white/70">
        Esta pantalla todavía no se abrió en este teléfono. Las que ya usaste funcionan sin señal, y lo que cargues (pedidos, salidas, llegadas, combustible) se guarda y se manda solo.
      </p>
      <a href="/inicio" className="grid min-h-[52px] place-items-center rounded-[var(--radius-caja)] bg-white px-6 font-semibold text-black">Probar de nuevo</a>
    </main>
  );
}
