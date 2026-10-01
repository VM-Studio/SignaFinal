import type { Metadata } from "next";
import { paraEtiquetas } from "@/lib/herramientas/consultas";
import { svgQR } from "@/lib/herramientas/qr";
import { BotonImprimir } from "./imprimir";

export const metadata: Metadata = { title: "Etiquetas" };

/** Hoja A4: 3 × 8 etiquetas de 70 × 37 mm (formato de etiqueta autoadhesiva común). */
export default async function HojaEtiquetas({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const ids = ((await searchParams).ids ?? "").split(",").filter(Boolean).slice(0, 240);
  const items = await paraEtiquetas(ids.length ? ids : undefined);
  const conQR = await Promise.all(items.map(async (i) => ({ ...i, qr: await svgQR(i.codigo) })));
  const hojas: (typeof conQR)[] = [];
  for (let i = 0; i < conQR.length; i += 24) hojas.push(conQR.slice(i, i + 24));

  return (
    <main className="min-h-dvh bg-[#888] py-6 print:bg-white print:p-0">
      <style>{`@page { size: A4; margin: 0 } @media print { #splash { display:none } }`}</style>
      <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-3 px-4 text-white print:hidden">
        <p className="font-semibold">{items.length} etiqueta{items.length === 1 ? "" : "s"} · {hojas.length} hoja{hojas.length === 1 ? "" : "s"} A4</p>
        <BotonImprimir />
      </div>
      {hojas.map((hoja, n) => (
        <section key={n} className="mx-auto mb-6 grid h-[297mm] w-[210mm] grid-cols-3 grid-rows-8 content-start gap-0 bg-white px-[0mm] py-[0.5mm] text-black print:mb-0 print:break-after-page">
          {hoja.map((i) => (
            <div key={i.id} className="flex h-[37mm] w-[70mm] items-center gap-[3mm] overflow-hidden border border-dashed border-black/15 px-[3mm] print:border-0">
              <div className="h-[29mm] w-[29mm] shrink-0 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: i.qr }} />
              <div className="min-w-0">
                <p className="text-[15pt] leading-none font-bold tabular-nums">{i.codigo}</p>
                <p className="mt-[1.5mm] line-clamp-3 text-[9pt] leading-tight font-semibold">{i.nombre}</p>
                <p className="mt-[1mm] text-[7pt] tracking-wide uppercase">SIGNA · Depósito</p>
              </div>
            </div>
          ))}
        </section>
      ))}
    </main>
  );
}
