"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, PlugZap, RefreshCw, XCircle } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { MensajeError, Selector } from "@/components/ui/campos";
import { useAviso } from "@/components/ui/avisos";
import { enlazar, probarConexion, sincronizarAhora } from "@/lib/cusat/acciones";
import type { Prueba } from "@/lib/cusat/tipos";

/** "Probar conexión" (muestra cada paso con su resultado) y "Sincronizar ahora". */
export function BotonesRastreo() {
  const router = useRouter();
  const aviso = useAviso();
  const [prueba, setPrueba] = useState<Prueba | null>(null);
  const [probando, setProbando] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [error, setError] = useState<string>();

  async function probar() {
    setProbando(true);
    setError(undefined);
    const r = await probarConexion();
    setProbando(false);
    if (!r.ok) return setError(r.error);
    setPrueba(r.datos);
  }

  async function sincronizar() {
    setSincronizando(true);
    setError(undefined);
    const r = await sincronizarAhora();
    setSincronizando(false);
    if (!r.ok) return setError(r.error);
    aviso({ mensaje: r.datos.texto });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Boton variante="secundario" cargando={probando} icono={<PlugZap />} onClick={probar}>Probar conexión</Boton>
        <Boton cargando={sincronizando} icono={<RefreshCw />} onClick={sincronizar}>Sincronizar ahora</Boton>
      </div>
      <MensajeError>{error}</MensajeError>
      {prueba && (
        <ol className="divide-y divide-linea rounded-[var(--radius-caja)] border border-linea bg-papel">
          {prueba.pasos.map((p) => (
            <li key={p.paso} className="flex gap-3 px-4 py-3">
              {p.ok ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-ok" /> : <XCircle className="mt-0.5 size-5 shrink-0 text-critico" />}
              <div className="min-w-0">
                <p className="font-semibold">{p.paso} <span className="font-normal text-suave">· {p.ms} ms</span></p>
                <p className="text-sm break-words text-suave">{p.detalle}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Enlazar a mano una unidad de Cusat con un vehículo (o desenlazar). */
export function EnlazarUnidad({ idExterno, vehiculos = [], desenlazar = false }: { idExterno: string; vehiculos?: { id: string; nombre: string }[]; desenlazar?: boolean }) {
  const router = useRouter();
  const aviso = useAviso();
  const [vehiculoId, setVehiculoId] = useState("");
  const [enviando, setEnviando] = useState(false);
  async function guardar(id: string) {
    setEnviando(true);
    const r = await enlazar(idExterno, id);
    setEnviando(false);
    if (!r.ok) return aviso({ mensaje: r.error, tono: "error" });
    aviso({ mensaje: id ? "Enlazado. Desde la próxima sincronización se ve en el mapa." : "Desenlazado." });
    router.refresh();
  }
  if (desenlazar) return <Boton tamano="chico" variante="fantasma" cargando={enviando} onClick={() => guardar("")}>Desenlazar</Boton>;
  return (
    <div className="flex w-full gap-2 sm:w-auto">
      <Selector aria-label="Enlazar con" value={vehiculoId} onChange={(e) => setVehiculoId(e.target.value)} className="sm:w-56">
        <option value="">Enlazar con…</option>
        {vehiculos.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
      </Selector>
      <Boton variante="secundario" disabled={!vehiculoId} cargando={enviando} onClick={() => guardar(vehiculoId)}>Enlazar</Boton>
    </div>
  );
}
