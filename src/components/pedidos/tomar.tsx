"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Hand } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Hoja } from "@/components/ui/hoja";
import { Opciones } from "@/components/ui/opciones";
import { Campo, Entrada, MensajeError, Selector } from "@/components/ui/campos";
import { useAviso } from "@/components/ui/avisos";
import { reasignarPedido, soltarPedido, tomarPedido } from "@/lib/pedidos/acciones";
import type { OpcionVehiculo } from "@/lib/pedidos/consultas";

/** Hora sugerida: dentro de media hora, redondeada a los 15 minutos. */
function horaSugerida() {
  const d = new Date(Date.now() + 30 * 60_000);
  const m = Math.ceil(d.getMinutes() / 15) * 15;
  d.setMinutes(m, 0, 0);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function ElegirVehiculo({ vehiculos, valor, onElegir }: { vehiculos: OpcionVehiculo[]; valor: string; onElegir: (v: string) => void }) {
  if (vehiculos.length === 0) return <MensajeError>No hay vehículos que puedan llevar este pedido.</MensajeError>;
  return (
    <Opciones
      nombre="Vehículo"
      valor={valor}
      onElegir={onElegir}
      opciones={vehiculos.map((v) => ({ valor: v.id, titulo: v.nombre, detalle: v.detalle, deshabilitada: !v.apto, motivo: v.motivo }))}
    />
  );
}

/** "Tomar": elige vehículo (solo los que sirven) y hora de salida, y confirma. */
export function BotonTomar({ pedidoId, numero, vehiculos, ancho = false, tamano = "normal" }: {
  pedidoId: string; numero: number; vehiculos: OpcionVehiculo[]; ancho?: boolean; tamano?: "normal" | "grande";
}) {
  const aptos = vehiculos.filter((v) => v.apto);
  const [abierta, setAbierta] = useState(false);
  const [vehiculoId, setVehiculoId] = useState(aptos.length === 1 ? aptos[0].id : "");
  const [salida, setSalida] = useState(horaSugerida);
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const aviso = useAviso();
  const router = useRouter();

  async function confirmar() {
    setEnviando(true);
    setError(undefined);
    const r = await tomarPedido({ pedidoId, vehiculoId, salida });
    setEnviando(false);
    if (!r.ok) {
      setError(r.error);
      router.refresh();
      return;
    }
    setAbierta(false);
    aviso({
      mensaje: `Tomaste el pedido ${r.datos.numero}. Salís ${r.datos.salida} con ${r.datos.vehiculo}.`,
      deshacer: async () => {
        const x = await soltarPedido(pedidoId);
        if (!x.ok) aviso({ mensaje: x.error, tono: "error" });
        router.refresh();
      },
    });
    router.refresh();
  }

  return (
    <>
      <Boton ancho={ancho} tamano={tamano} icono={<Hand className="size-5" />} onClick={() => { setError(undefined); setAbierta(true); }}>
        Tomar
      </Boton>
      <Hoja abierta={abierta} onCerrar={() => setAbierta(false)} titulo={`Tomar pedido ${numero}`}>
        <div className="flex flex-col gap-4">
          <p className="font-semibold">¿Con qué vehículo?</p>
          <ElegirVehiculo vehiculos={vehiculos} valor={vehiculoId} onElegir={setVehiculoId} />
          <Campo etiqueta="¿A qué hora salís, más o menos?" htmlFor={`salida-${pedidoId}`}>
            <Entrada id={`salida-${pedidoId}`} type="time" value={salida} onChange={(e) => setSalida(e.target.value)} />
          </Campo>
          <MensajeError>{error}</MensajeError>
          <Boton ancho tamano="grande" disabled={!vehiculoId || !salida} cargando={enviando} onClick={confirmar}>
            Confirmar
          </Boton>
        </div>
      </Hoja>
    </>
  );
}

/** Dirección: asignar el pedido a otro chofer, con vehículo y hora. */
export function BotonReasignar({ pedidoId, numero, choferes, vehiculos }: {
  pedidoId: string; numero: number; choferes: { id: string; nombre: string }[]; vehiculos: Record<string, OpcionVehiculo[]>;
}) {
  const [abierta, setAbierta] = useState(false);
  const [choferId, setChoferId] = useState("");
  const [vehiculoId, setVehiculoId] = useState("");
  const [salida, setSalida] = useState(horaSugerida);
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const aviso = useAviso();
  const router = useRouter();

  async function confirmar() {
    setEnviando(true);
    setError(undefined);
    const r = await reasignarPedido({ pedidoId, choferId, vehiculoId, salida });
    setEnviando(false);
    if (!r.ok) return setError(r.error);
    setAbierta(false);
    aviso({ mensaje: `Pedido ${numero} asignado a ${r.datos.chofer}.` });
    router.refresh();
  }

  return (
    <>
      <Boton variante="secundario" ancho onClick={() => setAbierta(true)}>Reasignar</Boton>
      <Hoja abierta={abierta} onCerrar={() => setAbierta(false)} titulo={`Reasignar pedido ${numero}`}>
        <div className="flex flex-col gap-4">
          <Campo etiqueta="Chofer" htmlFor="chofer">
            <Selector id="chofer" value={choferId} onChange={(e) => { setChoferId(e.target.value); setVehiculoId(""); }}>
              <option value="">Elegí el chofer</option>
              {choferes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </Selector>
          </Campo>
          {choferId && (
            <>
              <p className="font-semibold">Vehículo</p>
              <ElegirVehiculo vehiculos={vehiculos[choferId] ?? []} valor={vehiculoId} onElegir={setVehiculoId} />
            </>
          )}
          <Campo etiqueta="Hora de salida" htmlFor="salida-reasignar">
            <Entrada id="salida-reasignar" type="time" value={salida} onChange={(e) => setSalida(e.target.value)} />
          </Campo>
          <MensajeError>{error}</MensajeError>
          <Boton ancho tamano="grande" disabled={!choferId || !vehiculoId} cargando={enviando} onClick={confirmar}>Asignar</Boton>
        </div>
      </Hoja>
    </>
  );
}
