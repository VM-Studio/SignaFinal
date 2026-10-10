"use client";

import { useState } from "react";
import { Boton } from "@/components/ui/boton";
import { Campo, Entrada, AreaTexto, MensajeError } from "@/components/ui/campos";
import { SelectorDireccion } from "@/components/ui/selector-direccion";
import { crearProveedor, editarProveedor, guardarSucursal, type ProveedorConSucursales } from "@/lib/proveedores/acciones";

export type SucursalEditable = { id?: string; nombre: string; direccion: string; localidad: string; lat: number | null; lng: number | null; horarioRetiro: string; contacto: string; telefono: string; principal: boolean; activa?: boolean };
export const SUCURSAL_NUEVA: SucursalEditable = { nombre: "Casa central", direccion: "", localidad: "", lat: null, lng: null, horarioRetiro: "", contacto: "", telefono: "", principal: false };

/** Campos de una sucursal (dirección con mapa obligatoria, horario de retiro, contacto, teléfono). */
function CamposSucursal({ s, setS }: { s: SucursalEditable; setS: (f: (x: SucursalEditable) => SucursalEditable) => void }) {
  return (
    <>
      <Campo etiqueta="Nombre de la sucursal" htmlFor="su-nombre"><Entrada id="su-nombre" value={s.nombre} onChange={(e) => setS((x) => ({ ...x, nombre: e.target.value }))} maxLength={60} placeholder="Casa central, Sucursal Pilar…" /></Campo>
      <SelectorDireccion valor={s} onCambio={(v) => setS((x) => ({ ...x, direccion: v.direccion, localidad: x.localidad || v.localidad, lat: v.lat, lng: v.lng }))} />
      <Campo etiqueta="Localidad" htmlFor="su-loc"><Entrada id="su-loc" value={s.localidad} onChange={(e) => setS((x) => ({ ...x, localidad: e.target.value }))} maxLength={80} placeholder="Pilar" /></Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Horario de retiro" htmlFor="su-hor"><Entrada id="su-hor" value={s.horarioRetiro} onChange={(e) => setS((x) => ({ ...x, horarioRetiro: e.target.value }))} maxLength={120} placeholder="Lun a vie 7 a 16" /></Campo>
        <Campo etiqueta="Contacto" htmlFor="su-con"><Entrada id="su-con" value={s.contacto} onChange={(e) => setS((x) => ({ ...x, contacto: e.target.value }))} maxLength={120} placeholder="Sergio, playa de carga" /></Campo>
      </div>
      <Campo etiqueta="Teléfono de la sucursal" htmlFor="su-tel"><Entrada id="su-tel" inputMode="tel" value={s.telefono} onChange={(e) => setS((x) => ({ ...x, telefono: e.target.value }))} maxLength={40} /></Campo>
    </>
  );
}

const datosSucursal = (s: SucursalEditable) => ({
  nombre: s.nombre, direccion: s.direccion, localidad: s.localidad, lat: s.lat ?? undefined, lng: s.lng ?? undefined,
  horarioRetiro: s.horarioRetiro, contacto: s.contacto, telefono: s.telefono, principal: s.principal,
});

/**
 * Alta de proveedor (completa o rápida): nombre, teléfono y la primera sucursal ("Casa central" por
 * defecto) con dirección confirmada en el mapa. Al guardar devuelve el proveedor con su sucursal.
 */
export function FormularioProveedor({ rapido = false, onCreado }: { rapido?: boolean; onCreado: (p: ProveedorConSucursales) => void }) {
  const [p, setP] = useState({ nombre: "", cuit: "", telefono: "", email: "", rubro: "", notas: "" });
  const [s, setS] = useState<SucursalEditable>(SUCURSAL_NUEVA);
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  async function guardar() {
    setError(undefined);
    if (s.lat == null) return setError("Confirmá la dirección de la sucursal: elegí una sugerencia o poné el pin en el mapa.");
    setEnviando(true);
    const r = await crearProveedor({ proveedor: p, sucursal: { ...datosSucursal(s), principal: true } });
    setEnviando(false);
    if (!r.ok) return setError(r.error);
    onCreado(r.datos);
  }
  return (
    <div className="flex flex-col gap-4">
      <Campo etiqueta="Nombre del proveedor" htmlFor="pr-nombre"><Entrada id="pr-nombre" value={p.nombre} onChange={(e) => setP({ ...p, nombre: e.target.value })} maxLength={80} autoFocus placeholder="Corralón San Martín" /></Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Teléfono" htmlFor="pr-tel"><Entrada id="pr-tel" inputMode="tel" value={p.telefono} onChange={(e) => setP({ ...p, telefono: e.target.value })} maxLength={40} /></Campo>
        <Campo etiqueta="CUIT (opcional)" htmlFor="pr-cuit"><Entrada id="pr-cuit" inputMode="numeric" value={p.cuit} onChange={(e) => setP({ ...p, cuit: e.target.value })} maxLength={13} placeholder="30-12345678-9" /></Campo>
      </div>
      {!rapido && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Email (opcional)" htmlFor="pr-mail"><Entrada id="pr-mail" type="email" value={p.email} onChange={(e) => setP({ ...p, email: e.target.value })} maxLength={120} /></Campo>
            <Campo etiqueta="Rubro (opcional)" htmlFor="pr-rubro"><Entrada id="pr-rubro" value={p.rubro} onChange={(e) => setP({ ...p, rubro: e.target.value })} maxLength={60} placeholder="Corralón, ferretería…" /></Campo>
          </div>
          <Campo etiqueta="Notas (opcional)" htmlFor="pr-notas"><AreaTexto id="pr-notas" rows={2} value={p.notas} onChange={(e) => setP({ ...p, notas: e.target.value })} maxLength={500} /></Campo>
        </>
      )}
      <p className="etiqueta pt-2">Primera sucursal</p>
      <CamposSucursal s={s} setS={setS} />
      <MensajeError>{error}</MensajeError>
      <Boton ancho cargando={enviando} disabled={!p.nombre.trim() || !s.direccion.trim() || !s.localidad.trim()} onClick={guardar}>Cargar el proveedor</Boton>
    </div>
  );
}

/** Alta o edición de una sucursal de un proveedor. */
export function FormularioSucursal({ proveedorId, inicial, onGuardada }: { proveedorId: string; inicial?: SucursalEditable; onGuardada: (p: ProveedorConSucursales & { sucursalId: string }) => void }) {
  const [s, setS] = useState<SucursalEditable>(inicial ?? { ...SUCURSAL_NUEVA, nombre: "" });
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  async function guardar() {
    setError(undefined);
    if (s.lat == null) return setError("Confirmá la dirección: elegí una sugerencia o poné el pin en el mapa.");
    setEnviando(true);
    const r = await guardarSucursal(proveedorId, { ...datosSucursal(s), id: s.id, activa: s.activa });
    setEnviando(false);
    if (!r.ok) return setError(r.error);
    onGuardada(r.datos);
  }
  return (
    <div className="flex flex-col gap-4">
      <CamposSucursal s={s} setS={setS} />
      <label className="flex min-h-12 items-center gap-3 text-sm lg:min-h-9">
        <input type="checkbox" checked={s.principal} onChange={(e) => setS((x) => ({ ...x, principal: e.target.checked }))} className="size-5 accent-[#111827]" /> Sucursal principal
      </label>
      {s.id && (
        <label className="flex min-h-12 items-center gap-3 text-sm lg:min-h-9">
          <input type="checkbox" checked={s.activa !== false} onChange={(e) => setS((x) => ({ ...x, activa: e.target.checked }))} className="size-5 accent-[#111827]" /> Sucursal activa
        </label>
      )}
      <MensajeError>{error}</MensajeError>
      <Boton ancho cargando={enviando} disabled={!s.nombre.trim() || !s.direccion.trim() || !s.localidad.trim()} onClick={guardar}>{s.id ? "Guardar sucursal" : "Agregar sucursal"}</Boton>
    </div>
  );
}

export type ProveedorEditable = { id: string; nombre: string; cuit: string; telefono: string; email: string; rubro: string; notas: string; activo: boolean };

/** Edición de los datos del proveedor. */
export function FormularioEditarProveedor({ inicial, onGuardado }: { inicial: ProveedorEditable; onGuardado: () => void }) {
  const [p, setP] = useState(inicial);
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  async function guardar() {
    setEnviando(true);
    setError(undefined);
    const { id, ...datos } = p;
    const r = await editarProveedor(id, datos);
    setEnviando(false);
    if (!r.ok) return setError(r.error);
    onGuardado();
  }
  return (
    <div className="flex flex-col gap-4">
      <Campo etiqueta="Nombre" htmlFor="ep-nombre"><Entrada id="ep-nombre" value={p.nombre} onChange={(e) => setP({ ...p, nombre: e.target.value })} maxLength={80} /></Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Teléfono" htmlFor="ep-tel"><Entrada id="ep-tel" inputMode="tel" value={p.telefono} onChange={(e) => setP({ ...p, telefono: e.target.value })} maxLength={40} /></Campo>
        <Campo etiqueta="CUIT" htmlFor="ep-cuit"><Entrada id="ep-cuit" value={p.cuit} onChange={(e) => setP({ ...p, cuit: e.target.value })} maxLength={13} /></Campo>
        <Campo etiqueta="Email" htmlFor="ep-mail"><Entrada id="ep-mail" type="email" value={p.email} onChange={(e) => setP({ ...p, email: e.target.value })} maxLength={120} /></Campo>
        <Campo etiqueta="Rubro" htmlFor="ep-rubro"><Entrada id="ep-rubro" value={p.rubro} onChange={(e) => setP({ ...p, rubro: e.target.value })} maxLength={60} /></Campo>
      </div>
      <Campo etiqueta="Notas" htmlFor="ep-notas"><AreaTexto id="ep-notas" rows={3} value={p.notas} onChange={(e) => setP({ ...p, notas: e.target.value })} maxLength={500} /></Campo>
      <label className="flex min-h-12 items-center gap-3 text-sm lg:min-h-9">
        <input type="checkbox" checked={p.activo} onChange={(e) => setP({ ...p, activo: e.target.checked })} className="size-5 accent-[#111827]" /> Proveedor activo
      </label>
      <MensajeError>{error}</MensajeError>
      <Boton ancho cargando={enviando} disabled={!p.nombre.trim()} onClick={guardar}>Guardar cambios</Boton>
    </div>
  );
}
