"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, PlusCircle, RotateCcw, UserMinus } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Hoja } from "@/components/ui/hoja";
import { Campo, Entrada, MensajeError, Selector } from "@/components/ui/campos";
import { useAviso } from "@/components/ui/avisos";
import { asignarRazonAObra, cambiarProximoNumero, cambiarSolicitanteExterno, crearSolicitanteExterno, guardarRazonSocial } from "@/lib/compras/configuracion";

export type RazonEditable = { id?: string; nombre: string; cuit: string; activa: boolean; orden: number };

/** Alta o edición de una razón social (nombre tal como figura y CUIT). */
export function BotonRazonSocial({ inicial }: { inicial?: RazonEditable }) {
  const router = useRouter();
  const aviso = useAviso();
  const [abierta, setAbierta] = useState(false);
  const [r, setR] = useState<RazonEditable>(inicial ?? { nombre: "", cuit: "", activa: true, orden: 0 });
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  async function guardar() {
    setError(undefined);
    setEnviando(true);
    const x = await guardarRazonSocial(r);
    setEnviando(false);
    if (!x.ok) return setError(x.error);
    setAbierta(false);
    aviso({ mensaje: inicial ? "Guardado." : `${r.nombre} cargada.` });
    if (!inicial) setR({ nombre: "", cuit: "", activa: true, orden: 0 });
    router.refresh();
  }
  return (
    <>
      <Boton variante={inicial ? "secundario" : "primario"} tamano={inicial ? "chico" : "normal"} icono={inicial ? <Pencil /> : <PlusCircle />} onClick={() => setAbierta(true)}>{inicial ? "Editar" : "Nueva razón social"}</Boton>
      <Hoja abierta={abierta} onCerrar={() => setAbierta(false)} titulo={inicial ? inicial.nombre : "Nueva razón social"}>
        {abierta && (
          <div className="flex flex-col gap-4">
            <Campo etiqueta="Razón social" htmlFor="rs-nombre" ayuda="Tal como figura en la factura: “SIGNA DESARROLLOS S.A”."><Entrada id="rs-nombre" value={r.nombre} onChange={(e) => setR({ ...r, nombre: e.target.value })} maxLength={120} autoFocus /></Campo>
            <Campo etiqueta="CUIT" htmlFor="rs-cuit"><Entrada id="rs-cuit" inputMode="numeric" value={r.cuit} onChange={(e) => setR({ ...r, cuit: e.target.value })} placeholder="30-71704281-2" maxLength={13} /></Campo>
            <Campo etiqueta="Orden en las listas" htmlFor="rs-orden"><Entrada id="rs-orden" inputMode="numeric" value={String(r.orden)} onChange={(e) => setR({ ...r, orden: Number(e.target.value.replace(/\D/g, "")) || 0 })} /></Campo>
            {inicial && (
              <label className="flex min-h-12 items-center gap-3 text-sm lg:min-h-9">
                <input type="checkbox" checked={r.activa} onChange={(e) => setR({ ...r, activa: e.target.checked })} className="size-5 accent-[#111827]" /> Activa (aparece al armar órdenes)
              </label>
            )}
            <MensajeError>{error}</MensajeError>
            <Boton ancho cargando={enviando} disabled={!r.nombre.trim() || !r.cuit.trim()} onClick={guardar}>{inicial ? "Guardar" : "Cargar"}</Boton>
          </div>
        )}
      </Hoja>
    </>
  );
}

/** Con qué razón social compra cada obra (se elige y se guarda solo). */
export function RazonDeObra({ obraId, valor, razones }: { obraId: string; valor: string | null; razones: { id: string; nombre: string }[] }) {
  const router = useRouter();
  const aviso = useAviso();
  const [v, setV] = useState(valor ?? "");
  const [guardando, setGuardando] = useState(false);
  return (
    <Selector aria-label="Razón social que compra" value={v} disabled={guardando} onChange={async (e) => {
      const nuevo = e.target.value;
      setV(nuevo);
      setGuardando(true);
      const r = await asignarRazonAObra(obraId, nuevo || null);
      setGuardando(false);
      if (!r.ok) { setV(valor ?? ""); return aviso({ mensaje: r.error, tono: "error" }); }
      aviso({ mensaje: "Guardado." });
      router.refresh();
    }}>
      <option value="">La de siempre (Signa Desarrollos)</option>
      {razones.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
    </Selector>
  );
}

/** "Próximo número de OC / de PE": solo el dueño lo cambia, y solo hacia arriba. */
export function ProximoNumero({ tipo, ultimo, puedeEditar }: { tipo: "OC" | "PE"; ultimo: number; puedeEditar: boolean }) {
  const router = useRouter();
  const aviso = useAviso();
  const [valor, setValor] = useState(String(ultimo + 1));
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const etiqueta = tipo === "OC" ? "Próximo número de OC" : "Próximo número de PE";
  if (!puedeEditar) {
    return (
      <div>
        <p className="etiqueta">{etiqueta}</p>
        <p className="mt-1 text-[22px] font-semibold tabular-nums">{tipo}-{String(ultimo + 1).padStart(4, "0")}</p>
        <p className="text-[12px] text-suave">Lo cambia el dueño.</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <Campo etiqueta={etiqueta} htmlFor={`num-${tipo}`} ayuda={`Último usado: ${ultimo || "ninguno"}. Solo puede subir.`}>
        <Entrada id={`num-${tipo}`} inputMode="numeric" value={valor} onChange={(e) => setValor(e.target.value.replace(/\D/g, ""))} />
      </Campo>
      <MensajeError>{error}</MensajeError>
      <Boton variante="secundario" cargando={enviando} disabled={!valor || Number(valor) === ultimo + 1} onClick={async () => {
        setError(undefined);
        setEnviando(true);
        const r = await cambiarProximoNumero(tipo, Number(valor));
        setEnviando(false);
        if (!r.ok) return setError(r.error);
        aviso({ mensaje: `La próxima ${tipo} va a ser la ${valor}.` });
        router.refresh();
      }}>Guardar</Boton>
    </div>
  );
}

/** Los "Solicitado por" sin usuario: alta y baja. */
export function SolicitantesExternos({ lista }: { lista: { id: string; nombre: string; activo: boolean; ordenes: number }[] }) {
  const router = useRouter();
  const aviso = useAviso();
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string>();
  async function agregar() {
    setError(undefined);
    const r = await crearSolicitanteExterno(nombre);
    if (!r.ok) return setError(r.error);
    setNombre("");
    aviso({ mensaje: `${r.datos.nombre} agregado.` });
    router.refresh();
  }
  return (
    <div className="flex flex-col gap-3">
      <ul className="divide-y divide-linea rounded-[var(--radius-caja)] border border-linea bg-papel">
        {lista.length === 0 && <li className="px-4 py-3 text-sm text-suave">Sin nombres cargados.</li>}
        {lista.map((e) => (
          <li key={e.id} className={`flex min-h-12 items-center gap-3 px-4 py-2 lg:min-h-11 ${e.activo ? "" : "opacity-60"}`}>
            <span className="min-w-0 flex-1 truncate font-medium">{e.nombre}</span>
            <span className="text-[12px] text-suave">{e.ordenes} {e.ordenes === 1 ? "orden" : "órdenes"}</span>
            <Boton variante="fantasma" tamano="chico" icono={e.activo ? <UserMinus /> : <RotateCcw />} onClick={async () => {
              const r = await cambiarSolicitanteExterno(e.id, !e.activo);
              if (!r.ok) return aviso({ mensaje: r.error, tono: "error" });
              router.refresh();
            }}>{e.activo ? "Sacar" : "Volver a poner"}</Boton>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Entrada aria-label="Nombre" placeholder="Otro nombre (sin usuario)" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={60} onKeyDown={(e) => e.key === "Enter" && nombre.trim() && agregar()} />
        <Boton variante="secundario" icono={<PlusCircle />} disabled={!nombre.trim()} onClick={agregar}>Agregar</Boton>
      </div>
      <MensajeError>{error}</MensajeError>
    </div>
  );
}
