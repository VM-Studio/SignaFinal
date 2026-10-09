import Image from "next/image";
import Link from "next/link";

export default function NoEncontrado() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-negro px-6 text-center text-white">
      <Image src="/signalogo.png" alt="SIGNA" width={180} height={68} className="h-auto w-[160px]" />
      <h1 className="text-2xl font-semibold">Esta página no existe</h1>
      <Link href="/inicio" className="grid min-h-[52px] place-items-center rounded-[var(--radius-caja)] bg-white px-6 font-semibold text-negro">Ir al inicio</Link>
    </main>
  );
}
