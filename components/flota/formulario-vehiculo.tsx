"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pasos } from "@/components/ui/pasos";
import { Opciones } from "@/components/ui/opciones";
import { AreaTexto, Campo, Entrada, Interruptor, Selector } from "@/components/ui/campos";
import { useAviso } from "@/components/ui/avisos";
import { usePanel } from "@/components/ui/panel";
import { guardarVehiculo, type DatosVehiculo } from "@/lib/acciones/flota";
import { TIPO_VEHICULO } from "@/lib/etiquetas";

export type VehiculoEditable = {
  id?: string;
  nombre: string;
  tipo: "CAMION" | "CAMIONETA" | "AUTO" | "";
  patente: string;
  marca: string;
  modelo: string;
  anio: string;
  capacidadKg: string;
  costoKm: string;
  kmActual: string;
  seguroCompania: string;
  seguroPoliza: string;
  seguroVence: string;
  vtvVence: string;
  idCusat: string;
  asignadoAId: string;
  lugarId: string;
  disponibleParaPedidos: boolean;
  notas: string;
};

export const VEHICULO_VACIO: VehiculoEditable = {
  nombre: "", tipo: "", patente: "", marca: "", modelo: "", anio: "", capacidadKg: "", costoKm: "", kmActual: "",
  seguroCompania: "", seguroPoliza: "", seguroVence: "", vtvVence: "", idCusat: "", asignadoAId: "", lugarId: "",
  disponibleParaPedidos: true, notas: "",
};

export function FormularioVehiculo({
  inicial,
  personas,
  lugares,
}: {
  inicial: VehiculoEditable;
  personas: { id: string; nombre: string; rol: string }[];
  lugares: { id: string; nombre: string }[];
}) {
  const [v, setV] = useState(inicial);
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const router = useRouter();
  const aviso = useAviso();
  const panel = usePanel();
  const set = <K extends keyof VehiculoEditable>(k: K) => (valor: VehiculoEditable[K]) => setV((x) => ({ ...x, [k]: valor }));
  const texto = (k: keyof VehiculoEditable) => ({
    id: `veh-${k}`,
    value: v[k] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => set(k)(e.target.value as never),
  });

  async function guardar() {
    setEnviando(true);
    setError(undefined);
    const r = await guardarVehiculo({ ...v, tipo: v.tipo as DatosVehiculo["tipo"] });
    setEnviando(false);
    if (!r.ok) return setError(r.error);
    aviso({ mensaje: inicial.id ? "Cambios guardados." : `${v.nombre} agregado a la flota.` });
    panel.cerrar();
    router.refresh();
  }

  return (
    <Pasos
      titulos={["Vehículo", "Carga y costos", "Documentación", "Uso"]}
      textoFinal={inicial.id ? "Guardar cambios" : "Agregar a la flota"}
      onFinal={guardar}
      enviando={enviando}
      error={error}
      validar={(i) => {
        if (i === 0 && (!v.nombre.trim() || !v.tipo || v.patente.trim().length < 6)) return "Completá nombre, tipo y patente.";
        if (i === 1 && (v.capacidadKg === "" || v.costoKm === "" || v.kmActual === "")) return "Completá capacidad, costo por km y km actuales.";
      }}
    >
      <>
        <Campo etiqueta="Nombre" htmlFor="veh-nombre" ayuda="Como lo llaman todos: “Camión 5 tn”, “Camioneta Claudio”.">
          <Entrada {...texto("nombre")} maxLength={60} />
        </Campo>
        <Opciones nombre="Tipo" columnas={2} valor={v.tipo} onElegir={(t) => set("tipo")(t as VehiculoEditable["tipo"])} opciones={Object.entries(TIPO_VEHICULO).map(([valor, titulo]) => ({ valor, titulo }))} />
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Patente" htmlFor="veh-patente">
            <Entrada {...texto("patente")} autoCapitalize="characters" maxLength={12} />
          </Campo>
          <Campo etiqueta="Año" htmlFor="veh-anio">
            <Entrada {...texto("anio")} inputMode="numeric" maxLength={4} />
          </Campo>
          <Campo etiqueta="Marca" htmlFor="veh-marca">
            <Entrada {...texto("marca")} maxLength={40} />
          </Campo>
          <Campo etiqueta="Modelo" htmlFor="veh-modelo">
            <Entrada {...texto("modelo")} maxLength={40} />
          </Campo>
        </div>
      </>
      <>
        <Campo etiqueta="Capacidad de carga (kg)" htmlFor="veh-capacidadKg" ayuda="Se usa para saber qué pedidos puede llevar.">
          <Entrada {...texto("capacidadKg")} inputMode="numeric" />
        </Campo>
        <Campo etiqueta="Costo por km ($)" htmlFor="veh-costoKm" ayuda="Costo del viaje = km × este valor + peajes.">
          <Entrada {...texto("costoKm")} inputMode="decimal" />
        </Campo>
        <Campo etiqueta="Km actuales" htmlFor="veh-kmActual">
          <Entrada {...texto("kmActual")} inputMode="numeric" />
        </Campo>
      </>
      <>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Aseguradora" htmlFor="veh-seguroCompania">
            <Entrada {...texto("seguroCompania")} maxLength={60} />
          </Campo>
          <Campo etiqueta="Póliza" htmlFor="veh-seguroPoliza">
            <Entrada {...texto("seguroPoliza")} maxLength={40} />
          </Campo>
        </div>
        <Campo etiqueta="Seguro vence" htmlFor="veh-seguroVence">
          <Entrada {...texto("seguroVence")} type="date" />
        </Campo>
        <Campo etiqueta="VTV vence" htmlFor="veh-vtvVence" ayuda="Sin seguro o VTV vigentes no se puede usar para viajes.">
          <Entrada {...texto("vtvVence")} type="date" />
        </Campo>
      </>
      <>
        <Campo etiqueta="Asignado a" htmlFor="veh-asignadoAId" ayuda="Si es de un chofer, solo él lo usa para pedidos.">
          <Selector {...texto("asignadoAId")}>
            <option value="">Nadie (de uso general)</option>
            {personas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} · {p.rol}
              </option>
            ))}
          </Selector>
        </Campo>
        <Campo etiqueta="Se guarda en" htmlFor="veh-lugarId">
          <Selector {...texto("lugarId")}>
            <option value="">—</option>
            {lugares.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nombre}
              </option>
            ))}
          </Selector>
        </Campo>
        <Interruptor etiqueta="Entra en la cola de pedidos" detalle="Apagado para camionetas personales o del interior." checked={v.disponibleParaPedidos} onChange={(e) => set("disponibleParaPedidos")(e.target.checked)} />
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Equipo Cusat" htmlFor="veh-idCusat">
            <Entrada {...texto("idCusat")} maxLength={40} placeholder="Sin GPS" />
          </Campo>
          <Campo etiqueta="Notas" htmlFor="veh-notas">
            <AreaTexto {...texto("notas")} rows={1} className="min-h-[52px]" maxLength={500} />
          </Campo>
        </div>
      </>
    </Pasos>
  );
}
