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
import type { TipoPedido } from "@prisma/client";
import type { SugerenciaPlana } from "@/lib/viajes/combinar";
import { sugerenciasAlAceptar } from "@/lib/viajes/acciones-combinar";
import { validarCombinacion } from "@/lib/viajes/sugerencias";
import { peso } from "@/lib/formato";
import { ListaSugerencias } from "@/components/viajes/aprovecha";

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

/**
 * "Aceptar": primero "Aprovechá el viaje" (otros pedidos del mismo lugar o de camino, con casilla), después
 * el vehículo (los que no sirven, en gris con el motivo; si el peso total no entra, aviso y no deja confirmar).
 */
export function BotonTomar({ pedidoId, numero, vehiculos, pesoKg = null, tipo = "OTRO", ancho = false, tamano = "normal" }: {
  pedidoId: string; numero: number; vehiculos: OpcionVehiculo[]; pesoKg?: number | null; tipo?: TipoPedido; ancho?: boolean; tamano?: "normal" | "grande";
}) {
  const aptos = vehiculos.filter((v) => v.apto);
  const [abierta, setAbierta] = useState(false);
  const [paso, setPaso] = useState<"buscando" | "aprovecha" | "vehiculo">("buscando");
  const [sugerencias, setSugerencias] = useState<SugerenciaPlana[]>([]);
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [vehiculoId, setVehiculoId] = useState(aptos.length === 1 ? aptos[0].id : "");
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const aviso = useAviso();
  const router = useRouter();

  async function abrir() {
    setError(undefined);
    setElegidos([]);
    setPaso("buscando");
    setAbierta(true);
    // Sin señal no se buscan sugerencias: se acepta solo este.
    const r = navigator.onLine ? await sugerenciasAlAceptar(pedidoId).catch(() => null) : null;
    const lista = r?.ok ? r.datos.sugerencias : [];
    setSugerencias(lista);
    setPaso(lista.some((s) => !s.gris) ? "aprovecha" : "vehiculo");
  }

  // Lo que lleva en total (este más los que sumó) y si entra en el vehículo elegido.
  const sumados = sugerencias.filter((s) => elegidos.includes(s.id));
  const pesoTotal = (pesoKg ?? 0) + sumados.reduce((t, s) => t + (s.pedido.pesoKg ?? 0), 0);
  const vehiculo = vehiculos.find((v) => v.id === vehiculoId);
  const noEntra = vehiculo && sumados.length ? validarCombinacion([{ tipo, pesoKg }, ...sumados.map((s) => ({ tipo: s.pedido.tipo, pesoKg: s.pedido.pesoKg }))], vehiculo, 0) : null;

  async function confirmar() {
    setEnviando(true);
    setError(undefined);
    // Sale ahora: no se pregunta. Sin señal se guarda en el teléfono con la hora real y se manda solo al volver.
    const datos = { pedidoId, vehiculoId, salida: hhmm(new Date()), saleHoy: true, ocurridoEn: new Date().toISOString(), extras: elegidos };
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
      mensaje: elegidos.length ? `Aceptaste ${elegidos.length + 1} pedidos en un viaje con ${r.datos.vehiculo}.` : `Aceptaste el pedido ${r.datos.numero} con ${r.datos.vehiculo}.`,
      deshacer: elegidos.length ? undefined : async () => {
        const x = await soltarPedido(pedidoId);
        if (!x.ok) aviso({ mensaje: x.error, tono: "error" });
        router.refresh();
      },
    });
    router.refresh();
  }

  return (
    <>
      <Boton ancho={ancho} tamano={tamano} icono={<Hand />} onClick={abrir}>
        Aceptar
      </Boton>
      <Hoja abierta={abierta} onCerrar={() => setAbierta(false)} titulo={paso === "aprovecha" ? "Aprovechá el viaje" : `Aceptar pedido ${numero}`}>
        {paso === "buscando" && <p className="py-6 text-center text-suave">Buscando pedidos para combinar…</p>}
        {paso === "aprovecha" && (
          <div className="flex flex-col gap-4">
            <ListaSugerencias sugerencias={sugerencias} elegidos={elegidos} onCambiar={setElegidos} />
            <div className="flex flex-col gap-2">
              <Boton ancho tamano="grande" disabled={!elegidos.length} onClick={() => setPaso("vehiculo")}>
                {elegidos.length ? `Sumar ${elegidos.length} y elegir vehículo` : "Elegí los que vas a llevar"}
              </Boton>
              <Boton ancho variante="secundario" onClick={() => { setElegidos([]); setPaso("vehiculo"); }}>Seguir con este solo</Boton>
            </div>
          </div>
        )}
        {paso === "vehiculo" && (
          <div className="flex flex-col gap-4">
            {sumados.length > 0 && (
              <p className="rounded-md bg-fondo px-3 py-2 text-sm">
                Llevás <b>{sumados.length + 1} pedidos</b>{pesoTotal ? <> · <b>{peso(pesoTotal)}</b> en total</> : null}.{" "}
                <button type="button" className="font-medium underline" onClick={() => setPaso("aprovecha")}>Cambiar</button>
              </p>
            )}
            <p className="font-semibold">¿Con qué vehículo?</p>
            <ElegirVehiculo vehiculos={vehiculos} valor={vehiculoId} onElegir={setVehiculoId} />
            <MensajeError>{noEntra ?? error}</MensajeError>
            <Boton ancho tamano="grande" disabled={!vehiculoId || !!noEntra} cargando={enviando} onClick={confirmar}>
              Confirmar
            </Boton>
          </div>
        )}
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
