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
import { enviarOGuardar } from "@/lib/offline/cola";
import type { OpcionVehiculo } from "@/lib/pedidos/consultas";

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/** Hora sugerida: dentro de media hora, redondeada a los 15 minutos. */
function horaSugerida() {
  const d = new Date(Date.now() + 30 * 60_000);
  const m = Math.ceil(d.getMinutes() / 15) * 15;
  d.setMinutes(m, 0, 0);
  return hhmm(d);
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

/** "Aceptar": elige vehículo (los que no sirven, en gris con el motivo) y a qué hora sale, y confirma. */
export function BotonTomar({ pedidoId, numero, vehiculos, ancho = false, tamano = "normal" }: {
  pedidoId: string; numero: number; vehiculos: OpcionVehiculo[]; ancho?: boolean; tamano?: "normal" | "grande";
}) {
  const aptos = vehiculos.filter((v) => v.apto);
  const [abierta, setAbierta] = useState(false);
  const [vehiculoId, setVehiculoId] = useState(aptos.length === 1 ? aptos[0].id : "");
  const [cuando, setCuando] = useState<"ahora" | "hora" | "elegir">("ahora");
  const [elegida, setElegida] = useState(horaSugerida);
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const aviso = useAviso();
  const router = useRouter();

  async function confirmar() {
    setEnviando(true);
    setError(undefined);
    const salida = cuando === "ahora" ? hhmm(new Date()) : cuando === "hora" ? hhmm(new Date(Date.now() + 3_600_000)) : elegida;
    // Sin señal se guarda en el teléfono con la hora real y se manda solo al volver.
    const datos = { pedidoId, vehiculoId, salida, saleHoy: cuando !== "elegir", ocurridoEn: new Date().toISOString() };
    const r = await enviarOGuardar({ id: crypto.randomUUID(), tipo: "pedido.aceptar", pedidoId, descripcion: `Aceptar el pedido ${numero}`, datos }, () => tomarPedido(datos));
    setEnviando(false);
    if (r.estado === "error") {
      setError(r.error); // "Ya lo aceptó Cristian."
      router.refresh();
      return;
    }
    setAbierta(false);
    if (r.estado === "guardado") {
      aviso({ mensaje: `Sin señal: el pedido ${numero} quedó aceptado en el teléfono y se manda solo. Si otro lo aceptó antes, te avisamos.` });
      return;
    }
    aviso({
      mensaje: `Aceptaste el pedido ${r.datos.numero}. Salís ${r.datos.salida} con ${r.datos.vehiculo}.`,
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
      <Boton ancho={ancho} tamano={tamano} icono={<Hand className="size-5" />} onClick={() => { setError(undefined); setAbierta(true); }} className={tamano === "grande" ? "min-h-[64px] text-xl" : undefined}>
        Aceptar
      </Boton>
      <Hoja abierta={abierta} onCerrar={() => setAbierta(false)} titulo={`Aceptar pedido ${numero}`}>
        <div className="flex flex-col gap-4">
          <p className="font-semibold">¿Con qué vehículo?</p>
          <ElegirVehiculo vehiculos={vehiculos} valor={vehiculoId} onElegir={setVehiculoId} />
          <p className="font-semibold">¿Cuándo salís?</p>
          <Opciones nombre="Salida" columnas={3} valor={cuando} onElegir={(v) => setCuando(v as typeof cuando)} opciones={[{ valor: "ahora", titulo: "Ahora" }, { valor: "hora", titulo: "En 1 h" }, { valor: "elegir", titulo: "Elegir" }]} />
          {cuando === "elegir" && <Entrada aria-label="Hora de salida" type="time" value={elegida} onChange={(e) => setElegida(e.target.value)} />}
          <MensajeError>{error}</MensajeError>
          <Boton ancho tamano="grande" disabled={!vehiculoId || (cuando === "elegir" && !elegida)} cargando={enviando} onClick={confirmar}>
            Confirmar
          </Boton>
        </div>
      </Hoja>
    </>
  );
}

/** Dirección: asignar el pedido a otro chofer, con vehículo y hora. */
export function BotonReasignar({ pedidoId, numero, choferes, vehiculos, etiqueta = "Reasignar" }: {
  pedidoId: string; numero: number; choferes: { id: string; nombre: string }[]; vehiculos: Record<string, OpcionVehiculo[]>; etiqueta?: string;
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
      <Boton variante="secundario" ancho onClick={() => setAbierta(true)}>{etiqueta}</Boton>
      <Hoja abierta={abierta} onCerrar={() => setAbierta(false)} titulo={`${etiqueta} pedido ${numero}`}>
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
