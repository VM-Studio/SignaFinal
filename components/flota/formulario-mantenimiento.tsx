"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pasos } from "@/components/ui/pasos";
import { Opciones } from "@/components/ui/opciones";
import { Campo, Entrada } from "@/components/ui/campos";
import { useAviso } from "@/components/ui/avisos";
import { usePanel } from "@/components/ui/panel";
import { registrarMantenimiento, type DatosMantenimiento } from "@/lib/acciones/flota";
import { TIPO_MANTENIMIENTO } from "@/lib/etiquetas";
import { km as fmtKm } from "@/lib/formato";

export function FormularioMantenimiento({ vehiculoId, kmActual }: { vehiculoId: string; kmActual: number }) {
  const hoy = new Date().toISOString().slice(0, 10);
  const [d, setD] = useState({ tipo: "", descripcion: "", fecha: hoy, km: String(kmActual), costo: "", taller: "", proximoKm: "", proximaFecha: "" });
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const router = useRouter();
  const aviso = useAviso();
  const panel = usePanel();
  const campo = (k: keyof typeof d) => ({ id: `mant-${k}`, value: d[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setD({ ...d, [k]: e.target.value }) });

  async function guardar() {
    setEnviando(true);
    const r = await registrarMantenimiento({ ...d, vehiculoId, tipo: d.tipo as DatosMantenimiento["tipo"] });
    setEnviando(false);
    if (!r.ok) return setError(r.error);
    aviso({ mensaje: "Mantenimiento registrado." });
    panel.cerrar();
    router.refresh();
  }

  return (
    <Pasos
      titulos={["Qué se hizo", "Cuánto y dónde", "Próximo"]}
      textoFinal="Registrar"
      onFinal={guardar}
      enviando={enviando}
      error={error}
      validar={(i) => {
        if (i === 0 && (!d.tipo || d.descripcion.trim().length < 3)) return "Elegí el tipo y contá qué se hizo.";
      }}
    >
      <>
        <Opciones nombre="Tipo" columnas={2} valor={d.tipo} onElegir={(tipo) => setD({ ...d, tipo })} opciones={Object.entries(TIPO_MANTENIMIENTO).map(([valor, titulo]) => ({ valor, titulo }))} />
        <Campo etiqueta="Detalle" htmlFor="mant-descripcion">
          <Entrada {...campo("descripcion")} maxLength={300} placeholder="Ej.: cambio de aceite y filtros" />
        </Campo>
      </>
      <>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Fecha" htmlFor="mant-fecha">
            <Entrada {...campo("fecha")} type="date" max={hoy} />
          </Campo>
          <Campo etiqueta="Km" htmlFor="mant-km">
            <Entrada {...campo("km")} inputMode="numeric" />
          </Campo>
        </div>
        <Campo etiqueta="Costo ($)" htmlFor="mant-costo">
          <Entrada {...campo("costo")} inputMode="decimal" />
        </Campo>
        <Campo etiqueta="Taller" htmlFor="mant-taller">
          <Entrada {...campo("taller")} maxLength={80} />
        </Campo>
      </>
      <>
        <p className="text-suave">Si cargás el próximo, la app avisa cuando se acerque. Ahora tiene {fmtKm(kmActual)}.</p>
        <Campo etiqueta="Próximo a los km" htmlFor="mant-proximoKm">
          <Entrada {...campo("proximoKm")} inputMode="numeric" placeholder={String(kmActual + 10000)} />
        </Campo>
        <Campo etiqueta="O en la fecha" htmlFor="mant-proximaFecha">
          <Entrada {...campo("proximaFecha")} type="date" min={hoy} />
        </Campo>
      </>
    </Pasos>
  );
}
