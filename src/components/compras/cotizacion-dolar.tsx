"use client";

import { useEffect, useState } from "react";
import { DollarSign } from "lucide-react";
import { Hoja } from "@/components/ui/hoja";

type Cot = { compra: number; venta: number; fechaActualizacion: string };
type Dolar = { blue: Cot | null; oficial: Cot | null; consultadoEn: string; error: string | null; fuente: { nombre: string; url: string } };

const n = (x: number) => x.toLocaleString("es-AR", { maximumFractionDigits: 2 });
const hora = (iso: string) => new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
function hace(iso: string) {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `hace ${h} h` : `hace ${Math.round(h / 24)} días`;
}

/** Píldora verde pastel del navbar de Compras: 36px, ancho fijo (venta del blue y, desde 1280, del oficial). */
const PILDORA = "inline-flex h-9 w-[120px] shrink-0 items-center justify-center gap-1.5 rounded-full border border-[#CDE7D5] bg-[#E6F4EA] px-3 text-[13px] whitespace-nowrap text-[#1F3D2B] xl:w-[232px]";

function PanelVacio() {
  return (
    <div className="flex h-full flex-col rounded-[var(--radius-caja)] border border-linea bg-papel p-4">
      <span className="etiqueta">Dólar</span>
      <span className="mt-3 text-sm text-suave">Sin cotización por ahora: se vuelve a consultar sola.</span>
    </div>
  );
}

/**
 * COTIZACIÓN DEL DÓLAR (Compras, Dirección y Administración): "Blue 1.395 / 1.415 · Oficial 1.360 /
 * 1.410 · 14:32", compra / venta, como arriba de la planilla de Alejandra. Compacta en el header del
 * escritorio; tarjeta en el inicio del celular. Al tocarla, el detalle con la hora y la fuente. Lee
 * /api/dolar (caché de 15 min en el servidor) y se refresca sola cada 5 min.
 */
export function CotizacionDolar({ variante = "header" }: { variante?: "header" | "pildora" | "tarjeta" | "panel" }) {
  const [d, setD] = useState<Dolar | null>(null);
  const [abierta, setAbierta] = useState(false);
  useEffect(() => {
    let vivo = true;
    const traer = () => fetch("/api/dolar").then((r) => (r.ok ? r.json() : null)).then((x) => vivo && x && setD(x)).catch(() => {});
    traer();
    const t = setInterval(traer, 5 * 60_000);
    return () => { vivo = false; clearInterval(t); };
  }, []);
  // La píldora de Compras guarda su lugar aunque no haya cotización (el título del header cuenta con ese ancho).
  if (variante === "pildora" && (!d || (!d.blue && !d.oficial))) return <span className={PILDORA}><span className="opacity-60">Dólar sin datos</span></span>;
  if (variante === "panel" && (!d || (!d.blue && !d.oficial))) return <PanelVacio />;
  if (!d || (!d.blue && !d.oficial)) return variante === "tarjeta" ? null : <span className="hidden" />;
  const actualizado = d.blue?.fechaActualizacion ?? d.oficial?.fechaActualizacion ?? d.consultadoEn;
  // Escritorio angosto (1024–1279): solo la venta. Desde 1280: compra / venta y la hora.
  const corta = (
    <>
      {d.blue && <span><span className="text-suave">Blue</span> <span className="tabular-nums">{n(d.blue.venta)}</span></span>}
      {d.blue && d.oficial && <span className="text-suave"> · </span>}
      {d.oficial && <span><span className="text-suave">Oficial</span> <span className="tabular-nums">{n(d.oficial.venta)}</span></span>}
    </>
  );
  const linea = (
    <>
      {d.blue && <span><span className="text-suave">Blue</span> <span className="tabular-nums">{n(d.blue.compra)} / {n(d.blue.venta)}</span></span>}
      {d.blue && d.oficial && <span className="text-suave"> · </span>}
      {d.oficial && <span><span className="text-suave">Oficial</span> <span className="tabular-nums">{n(d.oficial.compra)} / {n(d.oficial.venta)}</span></span>}
      <span className="text-suave"> · {hora(actualizado)}</span>
    </>
  );
  return (
    <>
      {variante === "pildora" ? (
        <button onClick={() => setAbierta(true)} title={`Cotización del dólar (venta) · ${hora(actualizado)}`} className={`${PILDORA} hover:border-[#B5DCC1]`}>
          <span className="font-semibold">$</span>
          {d.blue && <span>Blue <span className="font-semibold tabular-nums">{n(d.blue.venta)}</span></span>}
          {d.blue && d.oficial && <span className="hidden opacity-60 xl:inline">·</span>}
          {d.oficial && <span className="hidden xl:inline">Oficial <span className="font-semibold tabular-nums">{n(d.oficial.venta)}</span></span>}
        </button>
      ) : variante === "panel" ? (
        <button onClick={() => setAbierta(true)} className="flex h-full w-full flex-col rounded-[var(--radius-caja)] border border-linea bg-papel p-4 text-left hover:bg-hover">
          <span className="etiqueta">Dólar</span>
          <span className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_auto] items-baseline gap-x-6 gap-y-2 text-[13px]">
            <span />
            <span className="text-right text-[11px] tracking-[0.06em] text-suave uppercase">Compra</span>
            <span className="text-right text-[11px] tracking-[0.06em] text-suave uppercase">Venta</span>
            {d.blue && <><span className="font-medium">Blue</span><span className="text-right tabular-nums">$ {n(d.blue.compra)}</span><span className="text-right font-semibold tabular-nums">$ {n(d.blue.venta)}</span></>}
            {d.oficial && <><span className="font-medium">Oficial</span><span className="text-right tabular-nums">$ {n(d.oficial.compra)}</span><span className="text-right font-semibold tabular-nums">$ {n(d.oficial.venta)}</span></>}
          </span>
          <span className="mt-auto pt-3 text-[12px] text-suave">Actualizado a las {hora(actualizado)} · {hace(actualizado)}</span>
        </button>
      ) : variante === "header" ? (
        <button onClick={() => setAbierta(true)} title="Cotización del dólar (compra / venta)" className="mr-2 hidden h-8 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium whitespace-nowrap hover:bg-black/[0.04] lg:inline-flex">
          <DollarSign className="size-3.5 text-suave" strokeWidth={1.75} />
          <span className="xl:hidden">{corta}</span>
          <span className="hidden xl:inline">{linea}</span>
        </button>
      ) : (
        <button onClick={() => setAbierta(true)} className="flex w-full items-center gap-3 rounded-[var(--radius-caja)] border border-linea bg-papel px-4 py-3 text-left text-sm">
          <DollarSign className="size-5 shrink-0 text-suave" strokeWidth={1.75} />
          <span className="min-w-0 flex-1 leading-snug">{linea}</span>
        </button>
      )}
      <Hoja abierta={abierta} onCerrar={() => setAbierta(false)} titulo="Cotización del dólar">
        <div className="flex flex-col gap-4">
          <table className="tabla">
            <thead><tr><th /><th className="text-right">Compra</th><th className="text-right">Venta</th></tr></thead>
            <tbody>
              {d.blue && <tr><td className="font-medium">Blue</td><td className="text-right tabular-nums">$ {n(d.blue.compra)}</td><td className="text-right tabular-nums">$ {n(d.blue.venta)}</td></tr>}
              {d.oficial && <tr><td className="font-medium">Oficial</td><td className="text-right tabular-nums">$ {n(d.oficial.compra)}</td><td className="text-right tabular-nums">$ {n(d.oficial.venta)}</td></tr>}
            </tbody>
          </table>
          <p className="text-sm text-suave">
            Actualizado a las {hora(actualizado)} ({hace(actualizado)}). Fuente: <a href={d.fuente.url} target="_blank" rel="noopener" className="underline">{d.fuente.nombre}</a>.
            {d.error ? " La última consulta no respondió: se muestra el último valor conocido." : ""}
          </p>
          <p className="text-[12px] text-suave">Las órdenes en dólares guardan la venta del oficial del día en que se arman.</p>
        </div>
      </Hoja>
    </>
  );
}
