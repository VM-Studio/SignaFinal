"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import jsQR from "jsqr";
import { CameraOff, Layers, ScanLine, Truck, X } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Hoja } from "@/components/ui/hoja";
import { Opciones } from "@/components/ui/opciones";
import { Campo, Entrada, Fecha, MensajeError, Selector } from "@/components/ui/campos";
import { Insignia } from "@/components/ui/basicos";
import { useAviso } from "@/components/ui/avisos";
import { buscarPorCodigo, entregarVarias } from "@/lib/herramientas/acciones";
import { ESTADO } from "@/lib/herramientas/presentacion";
import { diaISO, sumarDias } from "@/lib/formato";

type Leida = { id: string; nombre: string; codigo: string; estado: string; donde: string; tipoControl: string };
type Detector = { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> };

/** Cámara trasera leyendo QR. Usa BarcodeDetector si el teléfono lo tiene; si no, jsQR. */
function useCamara(onCodigo: (c: string) => void, activa: boolean) {
  const video = useRef<HTMLVideoElement>(null);
  const lienzo = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string>();
  const ultimo = useRef({ codigo: "", t: 0 });
  const cb = useRef(onCodigo);
  cb.current = onCodigo;

  useEffect(() => {
    if (!activa) return;
    let flujo: MediaStream | undefined;
    let cuadro = 0;
    let vivo = true;
    const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
    const detector = BD ? new BD({ formats: ["qr_code"] }) : null;

    const avisar = (texto: string) => {
      // El mismo QR frente a la cámara no se cuenta dos veces seguidas.
      const ahora = Date.now();
      if (texto === ultimo.current.codigo && ahora - ultimo.current.t < 2500) return;
      ultimo.current = { codigo: texto, t: ahora };
      cb.current(texto);
    };

    async function leer() {
      const v = video.current;
      if (!vivo || !v) return;
      if (v.readyState >= 2) {
        try {
          if (detector) {
            const r = await detector.detect(v);
            if (r[0]) avisar(r[0].rawValue);
          } else if (lienzo.current) {
            const c = lienzo.current;
            c.width = v.videoWidth;
            c.height = v.videoHeight;
            const ctx = c.getContext("2d", { willReadFrequently: true })!;
            ctx.drawImage(v, 0, 0);
            const r = jsQR(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
            if (r) avisar(r.data);
          }
        } catch {}
      }
      cuadro = requestAnimationFrame(leer);
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Este teléfono no deja usar la cámara desde la app. Escribí el código.");
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((s) => {
        flujo = s;
        if (video.current) {
          video.current.srcObject = s;
          void video.current.play();
          cuadro = requestAnimationFrame(leer);
        }
      })
      .catch(() => setError("No se pudo abrir la cámara. Dale permiso o escribí el código."));
    return () => {
      vivo = false;
      cancelAnimationFrame(cuadro);
      flujo?.getTracks().forEach((t) => t.stop());
    };
  }, [activa]);

  return { video, lienzo, error };
}

export function Escaner({ obras, personas }: { obras: { id: string; nombre: string; responsableId: string }[]; personas: { id: string; nombre: string }[] }) {
  const [modo, setModo] = useState<"una" | "varias">("una");
  const [lote, setLote] = useState<Leida[]>([]);
  const [manual, setManual] = useState("");
  const [mensaje, setMensaje] = useState<{ texto: string; error?: boolean }>();
  const [entregando, setEntregando] = useState(false);
  const router = useRouter();
  const ocupado = useRef(false);

  const procesar = useCallback(async (texto: string) => {
    if (ocupado.current) return;
    ocupado.current = true;
    const r = await buscarPorCodigo(texto);
    ocupado.current = false;
    if (!r.ok) return setMensaje({ texto: r.error, error: true });
    const h = r.datos;
    if (navigator.vibrate) navigator.vibrate(60);
    if (modo === "una") {
      router.push(`/herramientas/${h.id}${h.sugerida ? `?accion=${h.sugerida}` : ""}`);
      return;
    }
    if (h.tipoControl !== "UNITARIA") return setMensaje({ texto: `${h.nombre} se maneja por cantidad: entregala desde su ficha.`, error: true });
    if (h.estado !== "DISPONIBLE") return setMensaje({ texto: `${h.nombre} no está en el depósito (${h.donde}).`, error: true });
    setLote((l) => (l.some((x) => x.id === h.id) ? l : [...l, h]));
    setMensaje({ texto: `${h.nombre} agregada.` });
  }, [modo, router]);

  const { video, lienzo, error } = useCamara(procesar, !entregando);

  return (
    <div className="flex flex-col gap-4">
      <Opciones nombre="Modo" columnas={2} valor={modo} onElegir={(v) => { setModo(v as "una"); setMensaje(undefined); }} opciones={[
        { valor: "una", titulo: "Una por vez", detalle: "Abre la ficha", icono: <ScanLine className="size-5" /> },
        { valor: "varias", titulo: "Varias juntas", detalle: "Entregar en un paso", icono: <Layers className="size-5" /> },
      ]} />

      <div className="relative aspect-square w-full overflow-hidden rounded-[var(--radius-caja)] bg-negro sm:aspect-video">
        {error ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-white"><CameraOff className="size-10" /><p>{error}</p></div>
        ) : (
          <>
            <video ref={video} playsInline muted className="h-full w-full object-cover" />
            <div aria-hidden className="pointer-events-none absolute inset-[18%] rounded-xl border border-white/90" />
          </>
        )}
        <canvas ref={lienzo} hidden />
      </div>

      {mensaje && <p role="status" className={`rounded-[var(--radius-caja)] px-4 py-3 font-medium ${mensaje.error ? "bg-critico-fondo text-critico" : "bg-ok-fondo text-ok"}`}>{mensaje.texto}</p>}

      <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (manual.trim()) void procesar(manual); setManual(""); }}>
        <div className="flex-1">
          <Campo etiqueta="¿No lee? Escribí el código" htmlFor="codigo-manual">
            <Entrada id="codigo-manual" value={manual} onChange={(e) => setManual(e.target.value.toUpperCase())} autoCapitalize="characters" placeholder="SIG-0001" />
          </Campo>
        </div>
        <Boton type="submit" variante="secundario" disabled={!manual.trim()}>Buscar</Boton>
      </form>

      {modo === "varias" && (
        <section className="flex flex-col gap-2">
          <p className="etiqueta">Escaneadas ({lote.length})</p>
          {lote.length === 0 ? (
            <p className="text-suave">Escaneá las que van juntas a la misma obra.</p>
          ) : (
            <ul className="divide-y divide-linea overflow-hidden rounded-[var(--radius-caja)] border border-linea bg-papel">
              {lote.map((h) => (
                <li key={h.id} className="flex min-h-14 items-center gap-3 px-4 py-2">
                  <span className="min-w-0 flex-1"><span className="block font-semibold">{h.nombre}</span><span className="text-sm text-suave tabular-nums">{h.codigo}</span></span>
                  <Insignia tono={ESTADO[h.estado as keyof typeof ESTADO]?.tono ?? "neutro"}>{ESTADO[h.estado as keyof typeof ESTADO]?.texto ?? h.estado}</Insignia>
                  <button aria-label={`Sacar ${h.nombre}`} onClick={() => setLote((l) => l.filter((x) => x.id !== h.id))} className="grid size-11 place-items-center"><X className="size-5" /></button>
                </li>
              ))}
            </ul>
          )}
          <Boton ancho disabled={!lote.length} icono={<Truck />} onClick={() => setEntregando(true)}>
            Entregar {lote.length || ""} a una obra
          </Boton>
        </section>
      )}

      <Hoja abierta={entregando} onCerrar={() => setEntregando(false)} titulo={`Entregar ${lote.length} juntas`}>
        <EntregaLote ids={lote.map((h) => h.id)} obras={obras} personas={personas} alTerminar={() => { setLote([]); setEntregando(false); router.refresh(); }} />
      </Hoja>
    </div>
  );
}

function EntregaLote({ ids, obras, personas, alTerminar }: { ids: string[]; obras: { id: string; nombre: string; responsableId: string }[]; personas: { id: string; nombre: string }[]; alTerminar: () => void }) {
  const [obraId, setObraId] = useState("");
  const [recibe, setRecibe] = useState("");
  const [vuelve, setVuelve] = useState(sumarDias(diaISO(), 14));
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const aviso = useAviso();
  return (
    <div className="flex flex-col gap-4">
      <Campo etiqueta="¿A qué obra?" htmlFor="lote-obra">
        <Selector id="lote-obra" value={obraId} onChange={(e) => { setObraId(e.target.value); setRecibe(obras.find((o) => o.id === e.target.value)?.responsableId ?? ""); }}>
          <option value="">Elegí la obra</option>
          {obras.map((o) => <option key={o.id} value={o.id}>Obra {o.nombre}</option>)}
        </Selector>
      </Campo>
      <Campo etiqueta="¿Quién las recibe?" htmlFor="lote-recibe">
        <Selector id="lote-recibe" value={recibe} onChange={(e) => setRecibe(e.target.value)}>
          <option value="">Elegí la persona</option>
          {personas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </Selector>
      </Campo>
      <Campo etiqueta="¿Cuándo vuelven?" htmlFor="lote-vuelve"><Fecha id="lote-vuelve" value={vuelve} min={diaISO()} onChange={(e) => setVuelve(e.target.value)} /></Campo>
      <MensajeError>{error}</MensajeError>
      <Boton ancho disabled={!obraId || !recibe} cargando={enviando} onClick={async () => {
        setEnviando(true);
        const r = await entregarVarias({ ids, obraId, recibidoPorId: recibe, devolucionPrevista: vuelve });
        setEnviando(false);
        if (!r.ok) return setError(r.error);
        aviso({ mensaje: `${r.datos.cantidad} entregadas en Obra ${obras.find((o) => o.id === obraId)?.nombre}.` });
        alTerminar();
      }}>Entregar todas</Boton>
    </div>
  );
}
