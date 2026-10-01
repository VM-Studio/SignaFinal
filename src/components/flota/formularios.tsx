"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pasos } from "@/components/ui/pasos";
import { Opciones } from "@/components/ui/opciones";
import { AreaTexto, Campo, Entrada, Fecha, MensajeError, Selector } from "@/components/ui/campos";
import { Boton } from "@/components/ui/boton";
import { useAviso } from "@/components/ui/avisos";
import { useHoja } from "@/components/ui/hoja";
import { CampoFoto } from "@/components/viajes/campo-foto";
import {
  cambiarEstadoVehiculo, guardarDocumento, guardarVehiculo, registrarIncidente, registrarMantenimiento,
  type DatosDocumento, type DatosIncidente, type DatosMantenimiento, type DatosVehiculo,
} from "@/lib/flota/acciones";
import { DOCUMENTO } from "@/lib/etiquetas";
import { diaISO, km as fmtKm } from "@/lib/formato";

function useAlTerminar(mensaje: string) {
  const router = useRouter();
  const aviso = useAviso();
  const hoja = useHoja();
  return (texto = mensaje) => {
    aviso({ mensaje: texto });
    hoja.cerrar();
    router.refresh();
  };
}

// ═══════════════════════════ Vehículo ═══════════════════════════

export type VehiculoEditable = {
  id?: string; nombre: string; tipo: string; patente: string; marca: string; modelo: string; anio: string; capacidadCargaKg: string;
  kmActual: string; horasMotor: string; costoKm: string; entraEnCola: boolean; asignadoAId: string; baseId: string; idCusat: string;
};

export const VEHICULO_NUEVO: VehiculoEditable = {
  nombre: "", tipo: "", patente: "", marca: "", modelo: "", anio: String(new Date().getFullYear()), capacidadCargaKg: "", kmActual: "0",
  horasMotor: "", costoKm: "", entraEnCola: true, asignadoAId: "", baseId: "", idCusat: "",
};

const TIPOS = [
  { valor: "CAMION", titulo: "Camión" },
  { valor: "CAMIONETA", titulo: "Camioneta" },
  { valor: "AUTO", titulo: "Auto" },
  { valor: "MAQUINA", titulo: "Máquina" },
];

export function FormularioVehiculo({ inicial, personas, bases }: { inicial: VehiculoEditable; personas: { id: string; nombre: string }[]; bases: { id: string; nombre: string }[] }) {
  const [v, setV] = useState(inicial);
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const terminar = useAlTerminar(inicial.id ? "Cambios guardados." : "Vehículo agregado a la flota.");
  const campo = (k: keyof VehiculoEditable) => ({ id: `v-${k}`, value: v[k] as string, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value }) });

  async function guardar() {
    setEnviando(true);
    const r = await guardarVehiculo({ ...v, tipo: v.tipo as DatosVehiculo["tipo"] });
    setEnviando(false);
    if (!r.ok) return setError(r.error);
    terminar();
  }

  return (
    <Pasos
      titulos={["Vehículo", "Carga y costo", "Uso"]}
      textoFinal={inicial.id ? "Guardar cambios" : "Agregar a la flota"}
      onFinal={guardar}
      enviando={enviando}
      error={error}
      validar={(i) => {
        if (i === 0 && (!v.nombre.trim() || !v.tipo || v.patente.trim().length < 6 || !v.marca.trim() || !v.modelo.trim())) return "Completá nombre, tipo, patente, marca y modelo.";
        if (i === 1 && (v.capacidadCargaKg === "" || v.costoKm === "" || v.kmActual === "")) return "Completá capacidad, km y costo por km.";
      }}
    >
      <>
        <Campo etiqueta="Nombre" htmlFor="v-nombre" ayuda="Como lo llaman todos: “Camión 5 tn”."><Entrada {...campo("nombre")} maxLength={60} /></Campo>
        <Opciones nombre="Tipo" columnas={4} valor={v.tipo} onElegir={(tipo) => setV({ ...v, tipo })} opciones={TIPOS} />
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Patente" htmlFor="v-patente"><Entrada {...campo("patente")} autoCapitalize="characters" maxLength={12} placeholder="AB 123 CD" /></Campo>
          <Campo etiqueta="Año" htmlFor="v-anio"><Entrada {...campo("anio")} inputMode="numeric" maxLength={4} /></Campo>
          <Campo etiqueta="Marca" htmlFor="v-marca"><Entrada {...campo("marca")} maxLength={40} /></Campo>
          <Campo etiqueta="Modelo" htmlFor="v-modelo"><Entrada {...campo("modelo")} maxLength={40} /></Campo>
        </div>
      </>
      <>
        <Campo etiqueta="Capacidad de carga (kg)" htmlFor="v-capacidadCargaKg" ayuda="Define qué pedidos puede llevar."><Entrada {...campo("capacidadCargaKg")} inputMode="numeric" /></Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Km actuales" htmlFor="v-kmActual"><Entrada {...campo("kmActual")} inputMode="numeric" /></Campo>
          <Campo etiqueta="Horas de motor" htmlFor="v-horasMotor"><Entrada {...campo("horasMotor")} inputMode="numeric" placeholder="Opcional" /></Campo>
        </div>
        <Campo etiqueta="Costo por km ($)" htmlFor="v-costoKm" ayuda="Costo del viaje = km × este valor + peajes."><Entrada {...campo("costoKm")} inputMode="decimal" /></Campo>
      </>
      <>
        <label className="flex min-h-[56px] cursor-pointer items-center justify-between gap-4 rounded-[var(--radius-caja)] border-2 border-linea bg-papel px-4">
          <span>
            <span className="block font-semibold">Entra en la cola de pedidos</span>
            <span className="block text-sm text-suave">Apagado para camionetas personales o del interior.</span>
          </span>
          <input type="checkbox" checked={v.entraEnCola} onChange={(e) => setV({ ...v, entraEnCola: e.target.checked })} className="size-6 shrink-0 accent-negro" />
        </label>
        <Campo etiqueta="Asignado a" htmlFor="v-asignadoAId" ayuda="La camioneta propia de alguien.">
          <Selector {...campo("asignadoAId")}>
            <option value="">Nadie (uso general)</option>
            {personas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </Selector>
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Duerme en" htmlFor="v-baseId">
            <Selector {...campo("baseId")}>
              <option value="">—</option>
              {bases.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
            </Selector>
          </Campo>
          <Campo etiqueta="Equipo Cusat" htmlFor="v-idCusat"><Entrada {...campo("idCusat")} maxLength={40} placeholder="Sin GPS" /></Campo>
        </div>
      </>
    </Pasos>
  );
}

// ═══════════════════════════ Documento ═══════════════════════════

export function FormularioDocumento({ vehiculoId, tipoInicial }: { vehiculoId: string; tipoInicial?: string }) {
  const [tipo, setTipo] = useState(tipoInicial ?? "");
  const [vence, setVence] = useState("");
  const [notas, setNotas] = useState("");
  const [archivo, setArchivo] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const terminar = useAlTerminar("Documento cargado.");
  return (
    <div className="flex flex-col gap-4">
      <Opciones nombre="Documento" columnas={3} valor={tipo} onElegir={setTipo} opciones={Object.entries(DOCUMENTO).map(([valor, titulo]) => ({ valor, titulo }))} />
      <Campo etiqueta="Vence" htmlFor="doc-vence"><Fecha id="doc-vence" value={vence} onChange={(e) => setVence(e.target.value)} /></Campo>
      <CampoFoto etiqueta="Archivo (foto o PDF)" valor={archivo} onCambio={setArchivo} />
      <Campo etiqueta="Notas" htmlFor="doc-notas"><Entrada id="doc-notas" value={notas} onChange={(e) => setNotas(e.target.value)} maxLength={200} placeholder="Ej.: póliza 778812, Federación Patronal" /></Campo>
      <MensajeError>{error}</MensajeError>
      <Boton ancho tamano="grande" disabled={!tipo} cargando={enviando} onClick={async () => {
        setEnviando(true);
        const r = await guardarDocumento({ vehiculoId, tipo: tipo as DatosDocumento["tipo"], vencimiento: vence, notas, archivo: archivo ?? undefined });
        setEnviando(false);
        if (!r.ok) return setError(r.error);
        terminar();
      }}>Guardar documento</Boton>
    </div>
  );
}

// ═══════════════════════════ Mantenimiento ═══════════════════════════

export function FormularioMantenimiento({ vehiculoId, kmActual }: { vehiculoId: string; kmActual: number }) {
  const [d, setD] = useState({ tipo: "", fecha: diaISO(), km: String(kmActual), descripcion: "", taller: "", costo: "", proximoKm: "", proximaFecha: "" });
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const terminar = useAlTerminar("Mantenimiento registrado.");
  const campo = (k: keyof typeof d) => ({ id: `m-${k}`, value: d[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setD({ ...d, [k]: e.target.value }) });
  return (
    <Pasos
      titulos={["Qué se hizo", "Costo", "Próximo"]}
      textoFinal="Registrar"
      enviando={enviando}
      error={error}
      validar={(i) => (i === 0 && (!d.tipo || d.descripcion.trim().length < 3) ? "Elegí el tipo y contá qué se hizo." : i === 1 && d.costo === "" ? "Poné el costo." : undefined)}
      onFinal={async () => {
        setEnviando(true);
        const r = await registrarMantenimiento({ ...d, vehiculoId, tipo: d.tipo as DatosMantenimiento["tipo"] });
        setEnviando(false);
        if (!r.ok) return setError(r.error);
        terminar();
      }}
    >
      <>
        <Opciones nombre="Tipo" columnas={2} valor={d.tipo} onElegir={(tipo) => setD({ ...d, tipo })} opciones={[{ valor: "SERVICE", titulo: "Service" }, { valor: "REPARACION", titulo: "Reparación" }, { valor: "NEUMATICOS", titulo: "Neumáticos" }, { valor: "OTRO", titulo: "Otro" }]} />
        <Campo etiqueta="Qué se hizo" htmlFor="m-descripcion"><Entrada {...campo("descripcion")} maxLength={300} /></Campo>
      </>
      <>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Fecha" htmlFor="m-fecha"><Fecha {...campo("fecha")} max={diaISO()} /></Campo>
          <Campo etiqueta="Km" htmlFor="m-km"><Entrada {...campo("km")} inputMode="numeric" /></Campo>
        </div>
        <Campo etiqueta="Costo ($)" htmlFor="m-costo"><Entrada {...campo("costo")} inputMode="decimal" /></Campo>
        <Campo etiqueta="Taller" htmlFor="m-taller"><Entrada {...campo("taller")} maxLength={80} /></Campo>
      </>
      <>
        <p className="text-suave">Si cargás el próximo, la app avisa cuando se acerque. Hoy tiene {fmtKm(kmActual)}.</p>
        <Campo etiqueta="Próximo a los km" htmlFor="m-proximoKm"><Entrada {...campo("proximoKm")} inputMode="numeric" placeholder={String(kmActual + 10000)} /></Campo>
        <Campo etiqueta="O en la fecha" htmlFor="m-proximaFecha"><Fecha {...campo("proximaFecha")} min={diaISO()} /></Campo>
      </>
    </Pasos>
  );
}

// ═══════════════════════════ Incidente ═══════════════════════════

export function FormularioIncidente({ vehiculoId }: { vehiculoId: string }) {
  const [tipo, setTipo] = useState("");
  const [fecha, setFecha] = useState(diaISO());
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const terminar = useAlTerminar("Incidente registrado.");
  return (
    <div className="flex flex-col gap-4">
      <Opciones nombre="Qué pasó" columnas={2} valor={tipo} onElegir={setTipo} opciones={[{ valor: "MULTA", titulo: "Multa" }, { valor: "SINIESTRO", titulo: "Siniestro" }, { valor: "ROTURA", titulo: "Rotura" }, { valor: "ROBO", titulo: "Robo" }]} />
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Fecha" htmlFor="i-fecha"><Fecha id="i-fecha" value={fecha} max={diaISO()} onChange={(e) => setFecha(e.target.value)} /></Campo>
        <Campo etiqueta="Monto ($)" htmlFor="i-monto"><Entrada id="i-monto" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0" /></Campo>
      </div>
      <Campo etiqueta="Detalle" htmlFor="i-desc"><AreaTexto id="i-desc" rows={2} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} maxLength={400} /></Campo>
      <MensajeError>{error}</MensajeError>
      <Boton ancho tamano="grande" disabled={!tipo || descripcion.trim().length < 3} cargando={enviando} onClick={async () => {
        setEnviando(true);
        const r = await registrarIncidente({ vehiculoId, tipo: tipo as DatosIncidente["tipo"], fecha, descripcion, monto });
        setEnviando(false);
        if (!r.ok) return setError(r.error);
        terminar();
      }}>Registrar</Boton>
    </div>
  );
}

// ═══════════════════════════ Estado ═══════════════════════════

export function CambiarEstado({ vehiculoId, estado }: { vehiculoId: string; estado: string }) {
  const [enviando, setEnviando] = useState(false);
  const aviso = useAviso();
  const router = useRouter();
  if (estado === "EN_VIAJE") return <p className="text-sm text-suave">En viaje: el estado vuelve a Disponible al terminar.</p>;
  return (
    <Opciones
      nombre="Estado"
      columnas={3}
      valor={estado}
      onElegir={async (nuevo) => {
        if (enviando || nuevo === estado) return;
        setEnviando(true);
        const r = await cambiarEstadoVehiculo(vehiculoId, nuevo as "DISPONIBLE");
        setEnviando(false);
        if (!r.ok) return aviso({ mensaje: r.error, tono: "error" });
        aviso({
          mensaje: "Estado actualizado.",
          deshacer: async () => {
            await cambiarEstadoVehiculo(vehiculoId, estado as "DISPONIBLE");
            router.refresh();
          },
        });
        router.refresh();
      }}
      opciones={[{ valor: "DISPONIBLE", titulo: "Disponible" }, { valor: "EN_TALLER", titulo: "En el taller" }, { valor: "FUERA_DE_SERVICIO", titulo: "Fuera de servicio" }]}
    />
  );
}
