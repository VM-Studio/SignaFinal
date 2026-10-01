"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CloudOff, Fuel } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Opciones } from "@/components/ui/opciones";
import { Campo, Entrada, MensajeError } from "@/components/ui/campos";
import { useAviso } from "@/components/ui/avisos";
import { usePanel } from "@/components/ui/panel";
import { cargarCombustible } from "@/lib/acciones/flota";
import { enviarOGuardar } from "@/lib/offline/cola";
import { km } from "@/lib/formato";

export type VehiculoCarga = { id: string; nombre: string; detalle: string; kmActual: number };

/** Dos pasos: 1) qué vehículo, 2) litros, monto y km. */
export function FormularioCombustible({ vehiculos }: { vehiculos: VehiculoCarga[] }) {
  const router = useRouter();
  const aviso = useAviso();
  const panel = usePanel();
  const [vehiculoId, setVehiculoId] = useState<string>();
  const [litros, setLitros] = useState("");
  const [monto, setMonto] = useState("");
  const [kmTablero, setKmTablero] = useState("");
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const vehiculo = vehiculos.find((v) => v.id === vehiculoId);

  function reiniciar() {
    setVehiculoId(undefined);
    setLitros("");
    setMonto("");
    setKmTablero("");
    setGuardado(false);
  }

  async function guardar() {
    if (!vehiculo) return;
    setError(undefined);
    setEnviando(true);
    const datos = { clientId: crypto.randomUUID(), vehiculoId: vehiculo.id, litros: litros.replace(",", "."), monto: monto.replace(",", "."), km: kmTablero, ocurridoEn: new Date().toISOString() };
    const r = await enviarOGuardar("combustible.cargar", `Combustible ${vehiculo.nombre} (${litros} l)`, datos, () => cargarCombustible(datos));
    setEnviando(false);
    if (r.estado === "error") return setError(r.error);
    if (r.estado === "guardado") return setGuardado(true);
    aviso({ mensaje: `Carga registrada: ${litros} l en ${vehiculo.nombre}.` });
    if (panel.enPanel) panel.cerrar();
    reiniciar();
    router.refresh();
  }

  if (guardado) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <CloudOff className="size-10" />
        <p className="text-lg font-bold">Guardado en el teléfono</p>
        <p className="text-suave">Se manda solo cuando vuelva la señal.</p>
        <Boton variante="secundario" onClick={reiniciar}>
          Cargar otra
        </Boton>
      </div>
    );
  }

  if (!vehiculo) {
    return (
      <div>
        <h2 className="mb-3 text-xl font-bold">¿Qué vehículo cargaste?</h2>
        <Opciones nombre="Vehículo" valor={vehiculoId} onElegir={setVehiculoId} opciones={vehiculos.map((v) => ({ valor: v.id, titulo: v.nombre, detalle: v.detalle }))} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setVehiculoId(undefined)} aria-label="Cambiar vehículo" className="-ml-2 grid size-11 place-items-center rounded-md hover:bg-black/5">
          <ArrowLeft className="size-6" />
        </button>
        <h2 className="text-xl font-bold">{vehiculo.nombre}</h2>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Litros" htmlFor="litros">
          <Entrada id="litros" inputMode="decimal" value={litros} onChange={(e) => setLitros(e.target.value.replace(/[^\d.,]/g, ""))} className="text-xl font-bold tabular-nums" autoFocus />
        </Campo>
        <Campo etiqueta="Pagaste ($)" htmlFor="monto">
          <Entrada id="monto" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value.replace(/[^\d.,]/g, ""))} className="text-xl font-bold tabular-nums" />
        </Campo>
      </div>
      <Campo etiqueta="Km del tablero" htmlFor="km-carga" ayuda={`Último registrado: ${km(vehiculo.kmActual)}`}>
        <Entrada id="km-carga" inputMode="numeric" value={kmTablero} onChange={(e) => setKmTablero(e.target.value.replace(/\D/g, ""))} placeholder={String(vehiculo.kmActual)} />
      </Campo>
      <MensajeError>{error}</MensajeError>
      <Boton ancho tamano="grande" disabled={!litros || !monto} cargando={enviando} onClick={guardar} icono={<Fuel className="size-5" />}>
        Registrar carga
      </Boton>
    </div>
  );
}
