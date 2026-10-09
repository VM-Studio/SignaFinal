"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CloudOff, Fuel } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Campo, Entrada, MensajeError, Selector } from "@/components/ui/campos";
import { useAviso } from "@/components/ui/avisos";
import { registrarCarga } from "@/lib/viajes/acciones";
import { enviarOGuardar } from "@/lib/offline/cola";
import { km as fmtKm } from "@/lib/formato";
import { CampoFoto } from "./campo-foto";

type Vehiculo = { id: string; nombre: string; detalle: string; kmActual: number };

/** Cuatro campos: vehículo, litros, monto y foto del ticket. Km opcional. */
export function FormularioCombustible({ vehiculos, preseleccion, vehiculoEnViaje, obraEnViaje }: {
  vehiculos: Vehiculo[]; preseleccion: string | null; vehiculoEnViaje: string | null; obraEnViaje: string | null;
}) {
  const [vehiculoId, setVehiculoId] = useState(preseleccion ?? "");
  const [litros, setLitros] = useState("");
  const [monto, setMonto] = useState("");
  const [foto, setFoto] = useState<string | null>(null);
  const [kmTablero, setKm] = useState("");
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const aviso = useAviso();
  const router = useRouter();
  const v = vehiculos.find((x) => x.id === vehiculoId);
  const num = (s: string) => s.replace(",", ".");

  async function guardar() {
    if (!v) return setError("Elegí el vehículo.");
    setError(undefined);
    setEnviando(true);
    const datos = { clientId: crypto.randomUUID(), vehiculoId, litros: num(litros), monto: num(monto), km: kmTablero, foto: foto ?? undefined, ocurridoEn: new Date().toISOString() };
    const r = await enviarOGuardar({ id: datos.clientId, tipo: "combustible.cargar", descripcion: `Combustible ${v.nombre}: ${litros} l`, datos }, () => registrarCarga(datos));
    setEnviando(false);
    if (r.estado === "error") return setError(r.error);
    aviso({
      mensaje:
        r.estado === "guardado"
          ? "Sin señal: la carga quedó guardada y se manda sola."
          : `Carga registrada: ${litros} l en ${v.nombre}${r.datos.obra ? `, imputada a Obra ${r.datos.obra}` : ""}.`,
    });
    setLitros("");
    setMonto("");
    setFoto(null);
    setKm("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <Campo etiqueta="Vehículo" htmlFor="vehiculo">
        <Selector id="vehiculo" value={vehiculoId} onChange={(e) => setVehiculoId(e.target.value)}>
          <option value="">Elegí el vehículo</option>
          {vehiculos.map((x) => (
            <option key={x.id} value={x.id}>{x.nombre} · {x.detalle}</option>
          ))}
        </Selector>
      </Campo>
      {vehiculoId && vehiculoId === vehiculoEnViaje && obraEnViaje && (
        <p className="-mt-2 text-sm font-medium">Estás en viaje: se imputa a Obra {obraEnViaje}.</p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Litros" htmlFor="litros">
          <Entrada id="litros" inputMode="decimal" value={litros} onChange={(e) => setLitros(e.target.value.replace(/[^\d.,]/g, ""))} className="text-xl font-semibold tabular-nums" />
        </Campo>
        <Campo etiqueta="Pagaste ($)" htmlFor="monto">
          <Entrada id="monto" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value.replace(/[^\d.,]/g, ""))} className="text-xl font-semibold tabular-nums" />
        </Campo>
      </div>
      <CampoFoto etiqueta="Foto del ticket" valor={foto} onCambio={setFoto} />
      <Campo etiqueta="Km del tablero (opcional)" htmlFor="km-carga" ayuda={v ? `Último registrado: ${fmtKm(v.kmActual)}` : undefined}>
        <Entrada id="km-carga" inputMode="numeric" value={kmTablero} onChange={(e) => setKm(e.target.value.replace(/\D/g, ""))} />
      </Campo>
      <MensajeError>{error}</MensajeError>
      <Boton ancho tamano="grande" disabled={!vehiculoId || !litros || !monto} cargando={enviando} onClick={guardar} icono={<Fuel />}>
        Registrar carga
      </Boton>
      <p className="flex items-center gap-1.5 text-sm text-suave"><CloudOff className="size-4" /> Sin señal se guarda en el teléfono y se manda después.</p>
    </div>
  );
}
