"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";
import type { Franja } from "@prisma/client";
import { Boton } from "@/components/ui/boton";
import { Hoja } from "@/components/ui/hoja";
import { Opciones } from "@/components/ui/opciones";
import { Entrada, Fecha, MensajeError } from "@/components/ui/campos";
import { useAviso } from "@/components/ui/avisos";
import { diaISO, hora as fmtHora, sumarDias } from "@/lib/formato";
import { reprogramarPedido } from "@/lib/pedidos/acciones";

/**
 * "Reprogramar": cambiar el día (y la hora) de un pedido pendiente o aceptado que todavía no salió.
 * Lo ven Dirección y quien lo pidió. Al chofer le llega el aviso y sus recordatorios se recalculan.
 */
export function BotonReprogramar({ pedidoId, paraCuando, franja }: { pedidoId: string; paraCuando: Date | string; franja: Franja }) {
  const hoy = diaISO();
  const actual = diaISO(paraCuando);
  const [abierta, setAbierta] = useState(false);
  const [dia, setDia] = useState<"hoy" | "manana" | "fecha">(actual === hoy ? "hoy" : actual === sumarDias(hoy, 1) ? "manana" : "fecha");
  const [fecha, setFecha] = useState(actual < hoy ? hoy : actual);
  const [f, setF] = useState<Franja>(franja);
  const [hora, setHora] = useState(fmtHora(paraCuando));
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const aviso = useAviso();
  const router = useRouter();

  async function guardar() {
    setEnviando(true);
    setError(undefined);
    const r = await reprogramarPedido({ pedidoId, dia: dia === "hoy" ? hoy : dia === "manana" ? sumarDias(hoy, 1) : fecha, franja: f, hora: f === "HORA_EXACTA" ? hora : undefined });
    setEnviando(false);
    if (!r.ok) return setError(r.error);
    setAbierta(false);
    aviso({ mensaje: `Listo: ahora es para ${r.datos.para}.` });
    router.refresh();
  }

  return (
    <>
      <Boton variante="secundario" ancho icono={<CalendarClock />} onClick={() => setAbierta(true)}>Reprogramar</Boton>
      <Hoja abierta={abierta} onCerrar={() => setAbierta(false)} titulo="¿Para cuándo?">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Opciones nombre="Día" columnas={3} valor={dia} onElegir={(v) => setDia(v as typeof dia)} opciones={[{ valor: "hoy", titulo: "Hoy" }, { valor: "manana", titulo: "Mañana" }, { valor: "fecha", titulo: "Elegir fecha" }]} />
            {dia === "fecha" && <Fecha aria-label="Fecha" value={fecha} min={hoy} onChange={(e) => setFecha(e.target.value)} />}
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold">Hora aproximada</p>
            <Opciones nombre="Hora" columnas={3} valor={f} onElegir={(v) => setF(v as Franja)} opciones={[{ valor: "MANANA", titulo: "Mañana" }, { valor: "TARDE", titulo: "Tarde" }, { valor: "HORA_EXACTA", titulo: "Hora exacta" }]} />
            {f === "HORA_EXACTA" && <Entrada type="time" aria-label="Hora exacta" value={hora} onChange={(e) => setHora(e.target.value)} />}
          </div>
          <MensajeError>{error}</MensajeError>
          <Boton ancho tamano="grande" cargando={enviando} disabled={dia === "fecha" && !fecha} onClick={guardar}>Guardar la fecha nueva</Boton>
        </div>
      </Hoja>
    </>
  );
}
