"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import jsQR from "jsqr";
import { CameraOff } from "lucide-react";
import { Campo, Entrada } from "@/components/ui/campos";
import { Boton } from "@/components/ui/boton";

/** Lectura de QR por cámara. Usa BarcodeDetector si existe; si no, jsQR. */
export function Escaner() {
  const video = useRef<HTMLVideoElement>(null);
  const lienzo = useRef<HTMLCanvasElement>(null);
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [codigo, setCodigo] = useState("");

  useEffect(() => {
    let flujo: MediaStream | undefined;
    let cuadro = 0;
    let terminado = false;
    const Detector = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
    const detector = Detector ? new Detector({ formats: ["qr_code"] }) : null;

    function abrir(texto: string) {
      if (terminado) return;
      terminado = true;
      const m = texto.match(/\/d\/([^/?#]+)/);
      router.push(`/d/${encodeURIComponent(m ? decodeURIComponent(m[1]) : texto.trim())}`);
    }

    async function leer() {
      const v = video.current;
      if (!v || terminado) return;
      if (v.readyState >= 2) {
        try {
          if (detector) {
            const r = await detector.detect(v);
            if (r[0]) return abrir(r[0].rawValue);
          } else if (lienzo.current) {
            const c = lienzo.current;
            c.width = v.videoWidth;
            c.height = v.videoHeight;
            const ctx = c.getContext("2d", { willReadFrequently: true })!;
            ctx.drawImage(v, 0, 0);
            const r = jsQR(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
            if (r) return abrir(r.data);
          }
        } catch {}
      }
      cuadro = requestAnimationFrame(leer);
    }

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "environment" } })
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
      terminado = true;
      cancelAnimationFrame(cuadro);
      flujo?.getTracks().forEach((t) => t.stop());
    };
  }, [router]);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-square overflow-hidden rounded-[var(--radius-caja)] bg-negro">
        {error ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-white">
            <CameraOff className="size-10" />
            <p>{error}</p>
          </div>
        ) : (
          <>
            <video ref={video} playsInline muted className="h-full w-full object-cover" />
            <div className="pointer-events-none absolute inset-[18%] rounded-xl border-4 border-white/90" />
          </>
        )}
        <canvas ref={lienzo} hidden />
      </div>
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (codigo.trim()) router.push(`/d/${encodeURIComponent(codigo.trim().toUpperCase())}`);
        }}
      >
        <div className="flex-1">
          <Campo etiqueta="O escribí el código de la etiqueta" htmlFor="codigo">
            <Entrada id="codigo" value={codigo} onChange={(e) => setCodigo(e.target.value)} autoCapitalize="characters" placeholder="MQ-0001" />
          </Campo>
        </div>
        <Boton type="submit" variante="secundario">Abrir</Boton>
      </form>
    </div>
  );
}
