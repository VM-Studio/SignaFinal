"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, ListOrdered, PackageMinus, Plus } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Hoja } from "@/components/ui/hoja";
import { AreaTexto, Campo, Entrada, MensajeError } from "@/components/ui/campos";
import { useAviso } from "@/components/ui/avisos";
import { metros } from "@/lib/rutas/formato";
import { marcarFaltante, marcarItem } from "@/lib/viajes/acciones";
import { agregarParadas, reordenarParadas } from "@/lib/pedidos/acciones";
import { sugerenciasDelViaje } from "@/lib/viajes/acciones-combinar";
import type { PantallaViaje } from "@/lib/viajes/chofer";
import type { SugerenciaPlana } from "@/lib/viajes/combinar";
import { ListaSugerencias } from "./aprovecha";

type Parada = PantallaViaje["paradas"][number];
type Item = Parada["items"][number];

const ESTADO: Record<string, string> = { PENDIENTE: "Pendiente", EN_CAMINO: "En camino", LLEGO: "Estás acá", COMPLETADA: "Hecha", SALTEADA: "Salteada" };
const obraCorta = (s: string) => s.replace(/^Obra\s+/i, "").replace(/\s+\d+.*$/, "").trim() || s;

/** La lista numerada de todas las paradas, con su estado y los km de cada tramo. */
export function ListaParadas({ paradas, actualId, totalM }: { paradas: Parada[]; actualId: string | null; totalM: number }) {
  return (
    <section className="rounded-[var(--radius-caja)] border border-linea bg-papel">
      <p className="flex items-center justify-between border-b border-linea px-4 py-3">
        <span className="etiqueta">{paradas.length} paradas</span>
        {totalM > 0 && <span className="text-sm text-suave tabular-nums">{metros(totalM)} en total</span>}
      </p>
      <ol>
        {paradas.map((p, i) => {
          const actual = p.id === actualId;
          const hecha = p.estado === "COMPLETADA" || p.estado === "SALTEADA";
          return (
            <li key={p.id} className={`flex min-h-14 items-start gap-3 border-b border-linea px-4 py-2.5 last:border-b-0 ${actual ? "bg-hover" : ""}`}>
              <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-[12px] font-semibold tabular-nums ${hecha ? "bg-ok text-white" : actual ? "bg-tinta text-white" : "border border-linea-fuerte text-suave"}`}>
                {hecha ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block leading-snug ${actual ? "font-semibold" : "font-medium"} ${hecha ? "text-suave" : ""}`}>
                  {p.tipo === "RETIRO" ? "Retirar en" : "Entregar en"} {p.nombre}
                </span>
                <span className="block text-sm text-suave">
                  {[p.tipo === "RETIRO" && p.obras.length ? `para ${p.obras.map(obraCorta).join(", ")}` : null, p.distanciaDesdeAnteriorM ? metros(p.distanciaDesdeAnteriorM) : null].filter(Boolean).join(" · ")}
                </span>
              </span>
              <span className={`shrink-0 text-[12px] font-medium ${hecha ? "text-ok" : actual ? "text-tinta" : "text-suave"}`}>{ESTADO[p.estado]}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/**
 * La lista de verificación de la parada actual. RETIRO: "Cargar en …" con una línea por ítem, agrupadas
 * por obra ("→ Darwin: 40 bolsas cemento (OC-2026-0012)"). ENTREGA: solo los ítems de esa obra.
 * Cada línea se tilda; "Faltó" pide cuánto se retiró de verdad y por qué.
 */
export function ListaVerificacion({ parada, editable }: { parada: Parada; editable: boolean }) {
  const obras = [...new Set(parada.items.map((i) => i.obra))];
  return (
    <section>
      <p className="mb-2 text-[15px] font-semibold">{parada.tipo === "RETIRO" ? `Cargar en ${parada.nombre}` : `Entregar en ${parada.nombre}`}</p>
      <div className="flex flex-col gap-3">
        {obras.map((o) => (
          <div key={o}>
            {parada.tipo === "RETIRO" && obras.length > 1 && <p className="mb-1 etiqueta">→ {obraCorta(o)}</p>}
            <ul className="flex flex-col gap-2">
              {parada.items.filter((i) => i.obra === o).map((i) => <LineaItem key={i.id} item={i} conObra={parada.tipo === "RETIRO" && obras.length === 1} editable={editable} />)}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/** "40 bolsas"; si la descripción ya empieza con la unidad ("Barras de hierro"), solo el número. */
const cantidad = (i: Item) => {
  const unidad = i.unidad && !i.descripcion.toLowerCase().startsWith(i.unidad.toLowerCase().replace(/s$/, "")) ? i.unidad : null;
  return [i.cantidad != null ? new Intl.NumberFormat("es-AR").format(i.cantidad) : null, unidad].filter(Boolean).join(" ");
};

function LineaItem({ item, conObra, editable }: { item: Item; conObra: boolean; editable: boolean }) {
  const [marcado, setMarcado] = useState(item.marcado);
  const [abierta, setAbierta] = useState(false);
  const [real, setReal] = useState("");
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const router = useRouter();
  const aviso = useAviso();
  const texto = `${conObra ? `→ ${obraCorta(item.obra)}: ` : ""}${[cantidad(item), item.descripcion].filter(Boolean).join(" ")}${item.oc ? ` (${item.oc})` : ""}`;

  async function alternar() {
    if (!editable) return;
    const nuevo = !marcado;
    setMarcado(nuevo);
    const r = await marcarItem(item.id, nuevo);
    if (!r.ok) {
      setMarcado(!nuevo);
      aviso({ mensaje: r.error, tono: "error" });
    }
  }
  async function guardarFaltante() {
    setEnviando(true);
    setError(undefined);
    const r = await marcarFaltante({ itemId: item.id, cantidadReal: real, nota });
    setEnviando(false);
    if (!r.ok) return setError(r.error);
    setAbierta(false);
    aviso({ mensaje: "Listo: le avisamos al que lo pidió y a Compras." });
    router.refresh();
  }

  return (
    <li className="flex items-stretch gap-2">
      <button
        type="button"
        role="checkbox"
        aria-checked={marcado}
        disabled={!editable}
        onClick={alternar}
        className={`flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-md border px-3 py-2 text-left ${marcado && !item.faltante ? "border-ok/30 bg-ok-fondo" : "border-linea bg-papel"} disabled:cursor-default`}
      >
        <span aria-hidden className={`grid size-6 shrink-0 place-items-center rounded border ${marcado && !item.faltante ? "border-ok bg-ok text-white" : "border-linea-fuerte bg-papel"}`}>
          {marcado && !item.faltante && <Check className="size-4" strokeWidth={3} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block leading-snug">{texto}</span>
          {item.faltante && <span className="block text-sm font-medium text-critico">Faltó: {item.cantidadReal != null ? `se retiraron ${item.cantidadReal}${item.cantidad != null ? ` de ${item.cantidad}` : ""}` : "no se retiró todo"}{item.nota ? ` · ${item.nota}` : ""}</span>}
        </span>
      </button>
      {editable && !item.faltante && (
        <Boton variante="secundario" icono={<PackageMinus />} onClick={() => setAbierta(true)} className="shrink-0" aria-label={`Faltó ${item.descripcion}`}>Faltó</Boton>
      )}
      <Hoja abierta={abierta} onCerrar={() => setAbierta(false)} titulo="¿Cuánto se retiró?">
        <div className="flex flex-col gap-4">
          <p className="font-medium">{texto}</p>
          <Campo etiqueta={`Cantidad real${item.unidad ? ` (${item.unidad})` : ""}`} htmlFor={`real-${item.id}`} ayuda={item.cantidad != null ? `Se pidieron ${cantidad(item)}.` : undefined}>
            <Entrada id={`real-${item.id}`} inputMode="decimal" value={real} onChange={(e) => setReal(e.target.value.replace(/[^\d.,]/g, "").replace(",", "."))} placeholder="0" />
          </Campo>
          <Campo etiqueta="Nota (opcional)" htmlFor={`nota-${item.id}`}>
            <AreaTexto id={`nota-${item.id}`} rows={2} maxLength={300} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="No tenían más, mañana completan" />
          </Campo>
          <MensajeError>{error}</MensajeError>
          <Boton ancho tamano="grande" cargando={enviando} onClick={guardarFaltante}>Avisar que faltó</Boton>
        </div>
      </Hoja>
    </li>
  );
}

/** "Reordenar": subir o bajar paradas (el chofer conoce la zona). Lo hecho no se mueve; cada entrega va después de su retiro. */
export function BotonReordenar({ pedidoId, paradas, fijas }: { pedidoId: string; paradas: Parada[]; fijas: number }) {
  const [abierta, setAbierta] = useState(false);
  const [orden, setOrden] = useState(paradas.map((p) => p.id));
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const router = useRouter();
  const aviso = useAviso();
  const mover = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < fijas || j >= orden.length) return;
    const n = [...orden];
    [n[i], n[j]] = [n[j], n[i]];
    setOrden(n);
  };
  async function guardar() {
    setEnviando(true);
    setError(undefined);
    const r = await reordenarParadas(pedidoId, orden);
    setEnviando(false);
    if (!r.ok) return setError(r.error);
    setAbierta(false);
    aviso({ mensaje: "Orden guardado." });
    router.refresh();
  }
  return (
    <>
      <Boton variante="secundario" ancho icono={<ListOrdered />} onClick={() => { setOrden(paradas.map((p) => p.id)); setError(undefined); setAbierta(true); }}>Reordenar</Boton>
      <Hoja abierta={abierta} onCerrar={() => setAbierta(false)} titulo="Reordenar paradas">
        <div className="flex flex-col gap-3">
          <ol className="flex flex-col gap-2">
            {orden.map((id, i) => {
              const p = paradas.find((x) => x.id === id)!;
              const fija = i < fijas;
              return (
                <li key={id} className={`flex min-h-14 items-center gap-2 rounded-md border border-linea px-3 py-2 ${fija ? "bg-fondo text-suave" : "bg-papel"}`}>
                  <span className="w-5 text-sm font-semibold tabular-nums">{i + 1}</span>
                  <span className="min-w-0 flex-1 leading-snug">{p.tipo === "RETIRO" ? "Retirar en" : "Entregar en"} {p.nombre}</span>
                  {!fija && (
                    <>
                      <Boton variante="secundario" aria-label={`Subir ${p.nombre}`} disabled={i <= fijas} onClick={() => mover(i, -1)} className="w-11 px-0"><ArrowUp /></Boton>
                      <Boton variante="secundario" aria-label={`Bajar ${p.nombre}`} disabled={i === orden.length - 1} onClick={() => mover(i, 1)} className="w-11 px-0"><ArrowDown /></Boton>
                    </>
                  )}
                </li>
              );
            })}
          </ol>
          <MensajeError>{error}</MensajeError>
          <Boton ancho tamano="grande" cargando={enviando} onClick={guardar}>Guardar el orden</Boton>
        </div>
      </Hoja>
    </>
  );
}

/** "Agregar parada": las mismas sugerencias de "Aprovechá el viaje", mientras el viaje no llegó a ninguna parada. */
export function BotonAgregarParada({ pedidoId }: { pedidoId: string }) {
  const [abierta, setAbierta] = useState(false);
  const [sugerencias, setSugerencias] = useState<SugerenciaPlana[] | null>(null);
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const router = useRouter();
  const aviso = useAviso();
  async function abrir() {
    setAbierta(true);
    setSugerencias(null);
    setElegidos([]);
    setError(undefined);
    const r = await sugerenciasDelViaje(pedidoId);
    if (!r.ok) return setError(r.error);
    setSugerencias(r.datos.sugerencias);
  }
  async function sumar() {
    setEnviando(true);
    setError(undefined);
    const r = await agregarParadas({ pedidoId, extras: elegidos });
    setEnviando(false);
    if (!r.ok) return setError(r.error);
    setAbierta(false);
    aviso({ mensaje: r.datos.agregados === 1 ? "Sumaste 1 pedido al viaje." : `Sumaste ${r.datos.agregados} pedidos al viaje.` });
    router.refresh();
  }
  return (
    <>
      <Boton variante="secundario" ancho icono={<Plus />} onClick={abrir}>Agregar parada</Boton>
      <Hoja abierta={abierta} onCerrar={() => setAbierta(false)} titulo="Aprovechá el viaje">
        <div className="flex flex-col gap-4">
          {sugerencias === null && !error && <p className="py-6 text-center text-suave">Buscando pedidos para combinar…</p>}
          {sugerencias?.length === 0 && <p className="py-6 text-center text-suave">No hay pedidos pendientes en el mismo lugar ni cerca de tu camino.</p>}
          {sugerencias && sugerencias.length > 0 && <ListaSugerencias sugerencias={sugerencias} elegidos={elegidos} onCambiar={setElegidos} />}
          <MensajeError>{error}</MensajeError>
          {sugerencias && sugerencias.length > 0 && (
            <Boton ancho tamano="grande" disabled={!elegidos.length} cargando={enviando} onClick={sumar}>{elegidos.length ? `Sumar ${elegidos.length} al viaje` : "Elegí los que vas a llevar"}</Boton>
          )}
        </div>
      </Hoja>
    </>
  );
}
