"use client";

import { SelectorProveedorSucursal, type ValorProveedor } from "@/components/proveedores/selector";
import type { ProveedorConSucursales } from "@/lib/proveedores/acciones";
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Ban, Check, Hand, PackageCheck, PackageOpen, Stamp, X } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Hoja } from "@/components/ui/hoja";
import { Opciones } from "@/components/ui/opciones";
import { AreaTexto, Campo, Entrada, Fecha, MensajeError } from "@/components/ui/campos";
import { useAviso } from "@/components/ui/avisos";
import type { Resultado } from "@/lib/resultado";
import {
  aprobarMaterial, cancelarMaterial, deshacerAprobacion, habilitarRetiro, marcarRecibido, rechazarMaterial, tomarMaterial,
} from "@/lib/materiales/acciones";
import { nroOC, PESOS_MATERIAL } from "@/lib/materiales/presentacion";
import { diaISO, sumarDias } from "@/lib/formato";

/** Ejecuta una acción del servidor, avisa y refresca. */
function useAccion() {
  const router = useRouter();
  const aviso = useAviso();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string>();
  async function correr(fn: () => Promise<Resultado<unknown>>, mensaje: string, deshacer?: () => Promise<Resultado<unknown>>) {
    setEnviando(true);
    setError(undefined);
    const r = await fn();
    setEnviando(false);
    if (!r.ok) {
      setError(r.error);
      router.refresh();
      return false;
    }
    aviso({
      mensaje,
      deshacer: deshacer && (async () => {
        const x = await deshacer();
        if (!x.ok) aviso({ mensaje: x.error, tono: "error" });
        router.refresh();
      }),
    });
    router.refresh();
    return true;
  }
  return { correr, enviando, error, setError };
}

/** SOLICITADO → "Tomar". */
export function BotonTomarMaterial({ id }: { id: string }) {
  const { correr, enviando, error } = useAccion();
  return (
    <>
      <Boton ancho cargando={enviando} icono={<Hand />} onClick={() => correr(() => tomarMaterial(id), "Lo tomaste. Ahora está en compra.")}>Tomar</Boton>
      <MensajeError>{error}</MensajeError>
    </>
  );
}

function ConHojaPropia({ etiqueta, titulo, icono, variante = "primario", grande = false, children }: {
  etiqueta: string; titulo: string; icono?: ReactNode; variante?: "primario" | "secundario" | "peligro"; grande?: boolean; children: (cerrar: () => void) => ReactNode;
}) {
  const [abierta, setAbierta] = useState(false);
  return (
    <>
      <Boton ancho variante={variante} tamano={grande ? "grande" : "normal"} icono={icono} onClick={() => setAbierta(true)}>{etiqueta}</Boton>
      <Hoja abierta={abierta} onCerrar={() => setAbierta(false)} titulo={titulo}>{abierta && children(() => setAbierta(false))}</Hoja>
    </>
  );
}

/** ESPERANDO_APROBACION (Compras): para no frenar si el dueño no usa la app ese día. */
export function BotonAprobadoEnPapel({ id }: { id: string }) {
  const { correr, enviando, error } = useAccion();
  return (
    <>
      <Boton ancho variante="secundario" cargando={enviando} icono={<Stamp />} onClick={() => correr(() => aprobarMaterial(id, true), "Marcado como aprobado en papel. Queda registrado que lo marcaste vos.")}>
        El dueño ya aprobó en papel
      </Boton>
      <MensajeError>{error}</MensajeError>
    </>
  );
}

type RenglonOC = { descripcion: string; cantidad: number; unidad: string };
type DatosHabilitarHoja = {
  id: string; proveedores: ProveedorConSucursales[]; oc: string | null; descripcion: string; destino: { lat: number; lng: number } | null;
  /** Con OC aprobada en el sistema: proveedor, sucursal, número y renglones vienen cargados. */
  ocAprobada?: { proveedorId: string | null; sucursalId: string | null; numero: string | null; renglones: RenglonOC[] } | null;
};

/** APROBADO → "Habilitar para retirar". */
export function BotonHabilitar({ otraParte = false, ...d }: DatosHabilitarHoja & { otraParte?: boolean }) {
  return (
    <ConHojaPropia etiqueta={otraParte ? "Habilitar otra parte" : "Habilitar para retirar"} titulo="Habilitar para retirar" icono={<PackageOpen />} grande={!otraParte} variante={otraParte ? "secundario" : "primario"}>
      {(cerrar) => <FormHabilitar {...d} cerrar={cerrar} />}
    </ConHojaPropia>
  );
}

function FormHabilitar({ id, proveedores, oc, descripcion, destino, ocAprobada, cerrar }: DatosHabilitarHoja & { cerrar: () => void }) {
  const { correr, enviando, error } = useAccion();
  const [prov, setProv] = useState<ValorProveedor>({ proveedorId: ocAprobada?.proveedorId ?? null, sucursalId: ocAprobada?.sucursalId ?? null });
  const sucursalOC = proveedores.find((p) => p.id === ocAprobada?.proveedorId)?.sucursales.find((x) => x.id === ocAprobada?.sucursalId);
  // Renglones de la OC: se tildan los que entran en este retiro (retiros parciales).
  const renglonesOC = ocAprobada?.renglones ?? [];
  const [tildados, setTildados] = useState<boolean[]>(renglonesOC.map(() => true));
  const textoRenglones = (t: boolean[]) => renglonesOC.filter((_, i) => t[i]).map((r) => `${r.cantidad.toLocaleString("es-AR")} ${r.unidad} ${r.descripcion}`).join(" · ");
  const [horario, setHorario] = useState(sucursalOC?.horarioRetiro ?? "");
  const [contacto, setContacto] = useState(sucursalOC?.contacto ?? (sucursalOC?.telefono ? `Tel. ${sucursalOC.telefono}` : ""));
  const [ordenCompra, setOrdenCompra] = useState(ocAprobada?.numero ?? oc ?? "");
  const [que, setQue] = useState(renglonesOC.length ? textoRenglones(renglonesOC.map(() => true)) : descripcion.replace(/\n/g, " · "));
  const [pesoKg, setPesoKg] = useState("");
  const [modo, setModo] = useState<"RETIRA_CHOFER" | "ENTREGA_PROVEEDOR">("RETIRA_CHOFER");
  const [fechaEstimada, setFechaEstimada] = useState(sumarDias(diaISO(), 1));
  const [completo, setCompleto] = useState(true);
  return (
    <div className="flex flex-col gap-4">
      {ocAprobada?.numero && <p className="rounded-md bg-ok-fondo px-3 py-2 text-sm text-ok">Datos de la {ocAprobada.numero} aprobada: confirmá qué parte se habilita.</p>}
      <SelectorProveedorSucursal
        proveedores={proveedores}
        valor={prov}
        destino={destino}
        onCambio={(v, p) => {
          setProv(v);
          // Horario y contacto de la sucursal elegida (se pueden cambiar).
          const s = p?.sucursales.find((x) => x.id === v.sucursalId);
          if (s) { setHorario(s.horarioRetiro ?? ""); setContacto(s.contacto ?? (s.telefono ? `Tel. ${s.telefono}` : "")); }
        }}
      />
      <Opciones nombre="Modo" columnas={2} valor={modo} onElegir={(v) => setModo(v as typeof modo)} opciones={[{ valor: "RETIRA_CHOFER", titulo: "Lo retira un chofer" }, { valor: "ENTREGA_PROVEEDOR", titulo: "Lo entrega el proveedor" }]} />
      {modo === "RETIRA_CHOFER" ? (
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Horario de retiro" htmlFor="horario"><Entrada id="horario" value={horario} onChange={(e) => setHorario(e.target.value)} maxLength={120} placeholder="Lun a vie 8 a 12" /></Campo>
          <Campo etiqueta="Contacto" htmlFor="contacto"><Entrada id="contacto" value={contacto} onChange={(e) => setContacto(e.target.value)} maxLength={120} placeholder="Nombre y teléfono" /></Campo>
        </div>
      ) : (
        <Campo etiqueta="¿Cuándo lo entrega?" htmlFor="fecha-est"><Fecha id="fecha-est" value={fechaEstimada} min={diaISO()} onChange={(e) => setFechaEstimada(e.target.value)} /></Campo>
      )}
      {renglonesOC.length > 0 && (
        <fieldset>
          <legend className="mb-1 text-[12px] font-medium text-suave">Renglones de la OC que se habilitan ahora</legend>
          <ul className="divide-y divide-linea rounded-md border border-linea bg-papel">
            {renglonesOC.map((r, i) => (
              <li key={i}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 text-sm">
                  <input type="checkbox" checked={tildados[i]} onChange={(e) => { const t = tildados.map((x, j) => (j === i ? e.target.checked : x)); setTildados(t); setQue(textoRenglones(t) || que); setCompleto(t.every(Boolean)); }} className="size-5 accent-[#111827]" />
                  <span className="flex-1">{r.descripcion}</span>
                  <span className="shrink-0 text-suave tabular-nums">{r.cantidad.toLocaleString("es-AR")} {r.unidad}</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      )}
      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <Campo etiqueta="¿Qué se retira?" htmlFor="que"><Entrada id="que" value={que} onChange={(e) => setQue(e.target.value)} maxLength={300} /></Campo>
        <Campo etiqueta="Nro OC" htmlFor="oc-h"><Entrada id="oc-h" value={ordenCompra} onChange={(e) => setOrdenCompra(e.target.value)} maxLength={40} /></Campo>
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold">Peso aproximado</p>
        <Opciones nombre="Peso" columnas={2} valor={pesoKg} onElegir={setPesoKg} opciones={PESOS_MATERIAL.map((p) => ({ valor: String(p.kg), titulo: p.titulo }))} />
      </div>
      <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-[var(--radius-caja)] border border-linea bg-papel px-4">
        <input type="checkbox" checked={completo} onChange={(e) => setCompleto(e.target.checked)} className="size-6 accent-negro" />
        <span className="font-semibold">Con esto no falta nada del pedido</span>
      </label>
      <MensajeError>{error}</MensajeError>
      <Boton
        ancho cargando={enviando} disabled={!prov.proveedorId || !prov.sucursalId || !pesoKg || (renglonesOC.length > 0 && !tildados.some(Boolean))}
        onClick={async () =>
          (await correr(
            () => habilitarRetiro({ id, proveedorId: prov.proveedorId!, sucursalId: prov.sucursalId!, renglones: renglonesOC.filter((_, i) => tildados[i]), horario, contacto, ordenCompra, descripcion: que, pesoKg, modo, fechaEstimada: modo === "ENTREGA_PROVEEDOR" ? fechaEstimada : undefined, completo }),
            modo === "RETIRA_CHOFER" ? "Habilitado. La obra ya puede pedir el viaje." : "Listo. La obra sabe que lo lleva el proveedor.",
          )) && cerrar()
        }
      >
        Habilitar
      </Boton>
    </div>
  );
}

/** Cancelar con motivo (Compras siempre; quien pidió, solo mientras está pedido). */
export function BotonCancelarMaterial({ id, grande = false }: { id: string; grande?: boolean }) {
  return (
    <ConHojaPropia etiqueta="Cancelar pedido" titulo="Cancelar el pedido" icono={<Ban />} variante="secundario" grande={grande}>
      {(cerrar) => <FormMotivo etiqueta="¿Por qué se cancela?" boton="Cancelar el pedido" ok="Pedido cancelado." enviar={(m) => cancelarMaterial(id, m)} cerrar={cerrar} />}
    </ConHojaPropia>
  );
}

function FormMotivo({ etiqueta, boton, ok, enviar, cerrar }: { etiqueta: string; boton: string; ok: string; enviar: (m: string) => Promise<Resultado>; cerrar: () => void }) {
  const { correr, enviando, error } = useAccion();
  const [motivo, setMotivo] = useState("");
  return (
    <div className="flex flex-col gap-4">
      <Campo etiqueta={etiqueta} htmlFor="motivo"><AreaTexto id="motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} rows={3} autoFocus /></Campo>
      <MensajeError>{error}</MensajeError>
      <Boton ancho variante="peligro" cargando={enviando} disabled={motivo.trim().length < 3} onClick={async () => (await correr(() => enviar(motivo), ok)) && cerrar()}>{boton}</Boton>
    </div>
  );
}

/** El dueño: "Aprobar" (un toque, con deshacer) y "Rechazar" con motivo. */
export function BotonesAprobacion({ id, oc }: { id: string; oc: string | null }) {
  const { correr, enviando, error } = useAccion();
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <Boton cargando={enviando} icono={<Check />} onClick={() => correr(() => aprobarMaterial(id), `Aprobaste ${nroOC(oc) ? `la ${nroOC(oc)}` : "la OC"}. Compras y la obra ya lo saben.`, () => deshacerAprobacion(id))}>
          Aprobar
        </Boton>
        <ConHojaPropia etiqueta="Rechazar" titulo="Rechazar la OC" icono={<X />} variante="secundario" grande>
          {(cerrar) => <FormMotivo etiqueta="¿Por qué la rechazás? (lo lee Compras)" boton="Rechazar" ok="Rechazada. Vuelve a Compras con tu motivo." enviar={(m) => rechazarMaterial(id, m)} cerrar={cerrar} />}
        </ConHojaPropia>
      </div>
      <MensajeError>{error}</MensajeError>
    </div>
  );
}

/** Lo que trae el proveedor: "Llegó a la obra". */
export function BotonRecibido({ materialListoId }: { materialListoId: string }) {
  const { correr, enviando, error } = useAccion();
  return (
    <>
      <Boton ancho variante="secundario" cargando={enviando} icono={<PackageCheck />} onClick={() => correr(() => marcarRecibido(materialListoId), "Marcado como recibido en la obra.")}>Llegó a la obra</Boton>
      <MensajeError>{error}</MensajeError>
    </>
  );
}
