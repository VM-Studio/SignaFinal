"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, PlusCircle } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Hoja } from "@/components/ui/hoja";
import { Campo, Entrada, MensajeError } from "@/components/ui/campos";
import { Opciones } from "@/components/ui/opciones";
import { SelectorDireccion, type ValorDireccion } from "@/components/ui/selector-direccion";
import { useAviso } from "@/components/ui/avisos";
import { crearObra, editarObra, guardarSede } from "@/lib/obras/acciones";

export type Persona = { id: string; nombre: string };
export type ObraEditable = {
  id?: string; nombre: string; direccion: string; localidad: string; lat: number | null; lng: number | null;
  responsables: string[]; radioGeocercaM: number; estado?: "ACTIVA" | "PAUSADA" | "FINALIZADA";
};
export type ObraCreada = { id: string; nombre: string; localidad: string; direccion: string };

const NUEVA: ObraEditable = { nombre: "", direccion: "", localidad: "", lat: null, lng: null, responsables: [], radioGeocercaM: 200 };

/** Alta (o edición) de obra: nombre, dirección confirmada en el mapa, localidad, responsables y radio de la geocerca. */
export function FormularioObra({ inicial = NUEVA, responsables, onGuardada }: { inicial?: ObraEditable; responsables: Persona[]; onGuardada: (o: ObraCreada) => void }) {
  const [o, setO] = useState(inicial);
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const alternar = (id: string) => setO((x) => ({ ...x, responsables: x.responsables.includes(id) ? x.responsables.filter((y) => y !== id) : [...x.responsables, id] }));
  const dir: ValorDireccion = { direccion: o.direccion, localidad: o.localidad, lat: o.lat, lng: o.lng };

  async function guardar() {
    setError(undefined);
    if (o.lat == null) return setError("Confirmá la dirección: elegí una sugerencia o poné el pin en el mapa.");
    setEnviando(true);
    const datos = { nombre: o.nombre, direccion: o.direccion, localidad: o.localidad, lat: o.lat, lng: o.lng, responsables: o.responsables, radioGeocercaM: o.radioGeocercaM };
    const r = o.id ? await editarObra({ ...datos, id: o.id, estado: o.estado ?? "ACTIVA" }) : await crearObra(datos);
    setEnviando(false);
    if (!r.ok) return setError(r.error);
    onGuardada(o.id ? { id: o.id, nombre: o.nombre, localidad: o.localidad, direccion: o.direccion } : (r.datos as ObraCreada));
  }

  return (
    <div className="flex flex-col gap-4">
      <Campo etiqueta="Nombre" htmlFor="o-nombre" ayuda="Como la llaman todos: “Darwin 1299”, “Pinares II”.">
        <Entrada id="o-nombre" value={o.nombre} onChange={(e) => setO({ ...o, nombre: e.target.value })} maxLength={80} autoFocus />
      </Campo>
      <SelectorDireccion valor={dir} onCambio={(v) => setO((x) => ({ ...x, direccion: v.direccion, localidad: x.localidad || v.localidad, lat: v.lat, lng: v.lng }))} />
      <Campo etiqueta="Localidad" htmlFor="o-loc"><Entrada id="o-loc" value={o.localidad} onChange={(e) => setO({ ...o, localidad: e.target.value })} maxLength={80} placeholder="Villa Crespo, CABA" /></Campo>
      {responsables.length > 0 && (
        <div>
          <p className="mb-2 text-[12px] font-medium text-suave">Responsables (el primero que marques es el principal)</p>
          <div className="grid grid-cols-2 gap-2">
            {responsables.map((r) => {
              const si = o.responsables.includes(r.id);
              return (
                <button key={r.id} type="button" role="checkbox" aria-checked={si} onClick={() => alternar(r.id)}
                  className={`flex min-h-12 items-center gap-2 rounded-md border px-3 text-left text-sm font-medium lg:min-h-9 ${si ? "border-tinta bg-hover" : "border-linea bg-papel"}`}>
                  {si && <Check className="size-4 shrink-0" />} {r.nombre}{si && o.responsables[0] === r.id ? " · principal" : ""}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <Campo etiqueta="Radio de la geocerca (m)" htmlFor="o-radio" ayuda="A cuántos metros de la obra se da por llegado el vehículo.">
        <Entrada id="o-radio" inputMode="numeric" value={String(o.radioGeocercaM)} onChange={(e) => setO({ ...o, radioGeocercaM: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
      </Campo>
      {o.id && (
        <div>
          <p className="mb-2 text-[12px] font-medium text-suave">Estado</p>
          <Opciones nombre="Estado" columnas={3} valor={o.estado} onElegir={(v) => setO({ ...o, estado: v as ObraEditable["estado"] })} opciones={[{ valor: "ACTIVA", titulo: "Activa" }, { valor: "PAUSADA", titulo: "Pausada" }, { valor: "FINALIZADA", titulo: "Finalizada" }]} />
        </div>
      )}
      <MensajeError>{error}</MensajeError>
      <Boton ancho cargando={enviando} disabled={!o.nombre.trim() || !o.direccion.trim() || !o.localidad.trim()} onClick={guardar}>{o.id ? "Guardar cambios" : "Cargar la obra"}</Boton>
    </div>
  );
}

/** Botón "Nueva obra" con su hoja. onCreada: la pantalla que la abrió la deja seleccionada. */
export function NuevaObra({ responsables, onCreada, chico = false }: { responsables: Persona[]; onCreada?: (o: ObraCreada) => void; chico?: boolean }) {
  const router = useRouter();
  const aviso = useAviso();
  const [abierta, setAbierta] = useState(false);
  return (
    <>
      <Boton variante={chico ? "secundario" : "primario"} icono={<PlusCircle />} onClick={() => setAbierta(true)} className={chico ? "shrink-0" : undefined}>Nueva obra</Boton>
      <Hoja abierta={abierta} onCerrar={() => setAbierta(false)} titulo="Nueva obra">
        {abierta && (
          <FormularioObra
            responsables={responsables}
            onGuardada={(o) => {
              setAbierta(false);
              aviso({ mensaje: `Obra ${o.nombre} cargada.` });
              onCreada?.(o);
              router.refresh();
            }}
          />
        )}
      </Hoja>
    </>
  );
}

/** Editar obra (ficha de obra, Dirección y Administración). */
export function EditarObra({ obra, responsables }: { obra: ObraEditable; responsables: Persona[] }) {
  const router = useRouter();
  const aviso = useAviso();
  const [abierta, setAbierta] = useState(false);
  return (
    <>
      <Boton variante="secundario" onClick={() => setAbierta(true)}>Editar</Boton>
      <Hoja abierta={abierta} onCerrar={() => setAbierta(false)} titulo={`Editar ${obra.nombre}`}>
        {abierta && <FormularioObra inicial={obra} responsables={responsables} onGuardada={() => { setAbierta(false); aviso({ mensaje: "Obra actualizada." }); router.refresh(); }} />}
      </Hoja>
    </>
  );
}

export type SedeEditable = { id?: string; nombre: string; direccion: string; localidad: string; lat: number | null; lng: number | null; activa: boolean };

/** Alta o edición de una sede de la obra (más de un frente). */
export function BotonSede({ obraId, sede, etiqueta = "Agregar sede" }: { obraId: string; sede?: SedeEditable; etiqueta?: string }) {
  const router = useRouter();
  const aviso = useAviso();
  const [abierta, setAbierta] = useState(false);
  const [s, setS] = useState<SedeEditable>(sede ?? { nombre: "", direccion: "", localidad: "", lat: null, lng: null, activa: true });
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  async function guardar() {
    setError(undefined);
    if (s.lat == null) return setError("Confirmá la dirección en el mapa.");
    setEnviando(true);
    const r = await guardarSede({ ...s, obraId, lat: s.lat, lng: s.lng ?? undefined });
    setEnviando(false);
    if (!r.ok) return setError(r.error);
    setAbierta(false);
    aviso({ mensaje: sede ? "Sede actualizada." : `Sede ${s.nombre} agregada.` });
    router.refresh();
  }
  return (
    <>
      <Boton variante="secundario" tamano={sede ? "chico" : "normal"} icono={sede ? undefined : <PlusCircle />} onClick={() => setAbierta(true)}>{etiqueta}</Boton>
      <Hoja abierta={abierta} onCerrar={() => setAbierta(false)} titulo={sede ? `Sede ${sede.nombre}` : "Nueva sede"}>
        {abierta && (
          <div className="flex flex-col gap-4">
            <Campo etiqueta="Nombre de la sede" htmlFor="s-nombre" ayuda="Ej.: “Frente norte”, “Lote 14”."><Entrada id="s-nombre" value={s.nombre} onChange={(e) => setS({ ...s, nombre: e.target.value })} maxLength={80} autoFocus /></Campo>
            <SelectorDireccion valor={s} onCambio={(v) => setS((x) => ({ ...x, direccion: v.direccion, localidad: x.localidad || v.localidad, lat: v.lat, lng: v.lng }))} />
            <Campo etiqueta="Localidad" htmlFor="s-loc"><Entrada id="s-loc" value={s.localidad} onChange={(e) => setS({ ...s, localidad: e.target.value })} maxLength={80} /></Campo>
            {sede && (
              <label className="flex min-h-12 items-center gap-3 text-sm">
                <input type="checkbox" checked={s.activa} onChange={(e) => setS({ ...s, activa: e.target.checked })} className="size-5 accent-[#111827]" /> Sede activa
              </label>
            )}
            <MensajeError>{error}</MensajeError>
            <Boton ancho cargando={enviando} disabled={!s.nombre.trim() || !s.direccion.trim() || !s.localidad.trim()} onClick={guardar}>{sede ? "Guardar" : "Agregar sede"}</Boton>
          </div>
        )}
      </Hoja>
    </>
  );
}
