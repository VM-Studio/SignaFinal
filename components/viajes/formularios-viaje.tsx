"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CloudOff, Flag, Play } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Opciones } from "@/components/ui/opciones";
import { Campo, Entrada, MensajeError } from "@/components/ui/campos";
import { useAviso } from "@/components/ui/avisos";
import { finalizarViaje, iniciarViaje } from "@/lib/acciones/viajes";
import { enviarOGuardar } from "@/lib/offline/cola";
import { km, plata } from "@/lib/formato";
import type { VehiculoElegible } from "@/lib/datos/pedidos";

function GuardadoSinSenal({ texto }: { texto: string }) {
  return (
    <div className="flex items-start gap-3 rounded-[var(--radius-caja)] border-2 border-negro bg-papel p-4">
      <CloudOff className="mt-0.5 size-6 shrink-0" />
      <div>
        <p className="font-bold">Guardado en el teléfono</p>
        <p className="text-suave">{texto}</p>
      </div>
    </div>
  );
}

/** Salir: 1) con qué vehículo, 2) km del tablero. */
export function FormularioSalida({ pedidoId, numero, obra, vehiculos }: { pedidoId: string; numero: number; obra: string; vehiculos: VehiculoElegible[] }) {
  const router = useRouter();
  const aviso = useAviso();
  const disponibles = vehiculos.filter((v) => v.disponible);
  const [vehiculoId, setVehiculoId] = useState<string | undefined>(disponibles.length === 1 ? disponibles[0].id : undefined);
  const [paso, setPaso] = useState<1 | 2>(disponibles.length === 1 ? 2 : 1);
  const vehiculo = vehiculos.find((v) => v.id === vehiculoId);
  const [kmSalida, setKmSalida] = useState("");
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const [salidaGuardada, setSalidaGuardada] = useState<{ kmSalida: number; vehiculo?: string } | null>(null);
  const claveSalida = `signa:salida:${pedidoId}`;

  // Si la salida quedó guardada sin señal, al volver a esta pantalla se sigue con la llegada.
  useEffect(() => {
    try {
      const previa = localStorage.getItem(claveSalida);
      if (previa) setSalidaGuardada(JSON.parse(previa));
    } catch {}
  }, [claveSalida]);

  if (salidaGuardada) {
    return (
      <div className="flex flex-col gap-4">
        <GuardadoSinSenal texto={`Saliste con ${salidaGuardada.vehiculo ?? "el vehículo"}. La salida se manda sola cuando vuelva la señal.`} />
        <FormularioLlegada pedidoId={pedidoId} numero={numero} obra={obra} kmSalida={salidaGuardada.kmSalida} costoKm={null} alTerminar={() => localStorage.removeItem(claveSalida)} />
      </div>
    );
  }

  async function salir() {
    if (!vehiculoId) return;
    setError(undefined);
    setEnviando(true);
    const datos = { clientId: crypto.randomUUID(), pedidoId, vehiculoId, kmSalida: Number(kmSalida), ocurridoEn: new Date().toISOString() };
    const r = await enviarOGuardar("viaje.iniciar", `Salida del pedido ${numero} (Obra ${obra})`, datos, () => iniciarViaje(datos));
    setEnviando(false);
    if (r.estado === "error") return setError(r.error);
    if (r.estado === "guardado") {
      const salida = { kmSalida: Number(kmSalida), vehiculo: vehiculo?.nombre };
      try {
        localStorage.setItem(claveSalida, JSON.stringify(salida));
      } catch {}
      setSalidaGuardada(salida);
      return;
    }
    aviso({ mensaje: `Buen viaje. Saliste con ${vehiculo?.nombre}.` });
    router.refresh();
  }

  if (vehiculos.length === 0) {
    return <MensajeError>No hay vehículos que puedan llevar este pedido. Avisá a la oficina.</MensajeError>;
  }

  return (
    <div className="flex flex-col gap-4">
      {paso === 1 ? (
        <>
          <h2 className="text-xl font-bold">¿Con qué salís?</h2>
          <Opciones
            nombre="Vehículo"
            valor={vehiculoId}
            onElegir={(v) => {
              setVehiculoId(v);
              setPaso(2);
            }}
            opciones={vehiculos.map((v) => ({ valor: v.id, titulo: v.nombre, detalle: v.detalle, deshabilitada: !v.disponible, motivo: v.motivo }))}
          />
        </>
      ) : (
        <>
          <div className="flex items-center gap-2">
            {disponibles.length > 1 && (
              <button type="button" onClick={() => setPaso(1)} aria-label="Cambiar vehículo" className="-ml-2 grid size-11 place-items-center rounded-md hover:bg-black/5">
                <ArrowLeft className="size-6" />
              </button>
            )}
            <h2 className="text-xl font-bold">Salís con {vehiculo?.nombre}</h2>
          </div>
          <Campo etiqueta="Km del tablero ahora" htmlFor="km-salida" ayuda={vehiculo ? `Último registrado: ${km(vehiculo.kmActual)}` : undefined}>
            <Entrada id="km-salida" inputMode="numeric" pattern="[0-9]*" value={kmSalida} onChange={(e) => setKmSalida(e.target.value.replace(/\D/g, ""))} placeholder={vehiculo ? String(vehiculo.kmActual) : ""} className="text-2xl font-bold tabular-nums" autoFocus />
          </Campo>
          <MensajeError>{error}</MensajeError>
          <Boton ancho tamano="grande" disabled={!kmSalida} cargando={enviando} onClick={salir} icono={<Play className="size-5" />}>
            Salir ahora
          </Boton>
        </>
      )}
    </div>
  );
}

/** Llegar: km del tablero y peajes. El costo se calcula solo. */
export function FormularioLlegada({
  pedidoId, numero, obra, kmSalida, costoKm, alTerminar,
}: { pedidoId: string; numero: number; obra: string; kmSalida: number; costoKm: number | null; alTerminar?: () => void }) {
  const router = useRouter();
  const aviso = useAviso();
  const [kmLlegada, setKmLlegada] = useState("");
  const [peajes, setPeajes] = useState("");
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  const recorridos = kmLlegada ? Number(kmLlegada) - kmSalida : null;
  const estimado = recorridos != null && recorridos >= 0 && costoKm != null ? recorridos * costoKm + Number(peajes || 0) : null;

  if (guardado) return <GuardadoSinSenal texto="La llegada se manda sola cuando vuelva la señal." />;

  async function llegar() {
    setError(undefined);
    if (recorridos != null && recorridos < 0) return setError(`Los km de llegada no pueden ser menos que los de salida (${km(kmSalida)}).`);
    setEnviando(true);
    const datos = { clientId: crypto.randomUUID(), pedidoId, kmLlegada: Number(kmLlegada), peajes: peajes || "0", ocurridoEn: new Date().toISOString() };
    const r = await enviarOGuardar("viaje.finalizar", `Llegada del pedido ${numero} (Obra ${obra})`, datos, () => finalizarViaje(datos));
    setEnviando(false);
    if (r.estado === "error") return setError(r.error);
    alTerminar?.();
    if (r.estado === "guardado") return setGuardado(true);
    aviso({ mensaje: `Entregado. ${km(r.datos.kmRecorridos)}, ${plata(r.datos.costo)} a Obra ${obra}.` });
    router.push("/inicio");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-bold">¿Llegaste a Obra {obra}?</h2>
      <Campo etiqueta="Km del tablero al llegar" htmlFor="km-llegada" ayuda={`Saliste con ${km(kmSalida)}`}>
        <Entrada id="km-llegada" inputMode="numeric" pattern="[0-9]*" value={kmLlegada} onChange={(e) => setKmLlegada(e.target.value.replace(/\D/g, ""))} placeholder={String(kmSalida)} className="text-2xl font-bold tabular-nums" />
      </Campo>
      <Campo etiqueta="Peajes pagados ($)" htmlFor="peajes" ayuda="Dejalo vacío si no pagaste.">
        <Entrada id="peajes" inputMode="decimal" value={peajes} onChange={(e) => setPeajes(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0" />
      </Campo>
      {estimado != null && (
        <p className="text-suave">
          {km(recorridos)} recorridos · costo {plata(estimado)}
        </p>
      )}
      <MensajeError>{error}</MensajeError>
      <Boton ancho tamano="grande" disabled={!kmLlegada} cargando={enviando} onClick={llegar} icono={<Flag className="size-5" />}>
        Llegué, entregado
      </Boton>
    </div>
  );
}
