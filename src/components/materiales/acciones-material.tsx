"use client";

import { SelectorProveedorSucursal, type ValorProveedor } from "@/components/proveedores/selector";
import type { ProveedorConSucursales } from "@/lib/proveedores/acciones";
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Ban, Check, FileCheck2, Hand, PackageCheck, PackageOpen, Stamp, X } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Hoja } from "@/components/ui/hoja";
import { Opciones } from "@/components/ui/opciones";
import { AreaTexto, Campo, Entrada, Fecha, MensajeError } from "@/components/ui/campos";
import { useAviso } from "@/components/ui/avisos";
import type { Resultado } from "@/lib/resultado";
import {
  aprobarMaterial, cancelarMaterial, deshacerAprobacion, habilitarRetiro, marcarRecibido, pedirAprobacion, rechazarMaterial, tomarMaterial,
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

/** EN_COMPRA → "OC armada, pedir aprobación": número de OC y monto. */
export function BotonPedirAprobacion({ id, ocInicial }: { id: string; ocInicial: string | null }) {
  return (
    <ConHojaPropia etiqueta="OC armada, pedir aprobación" titulo="Pedir aprobación al dueño" icono={<FileCheck2 />} grande>
      {(cerrar) => <FormAprobacion id={id} ocInicial={ocInicial} cerrar={cerrar} />}
    </ConHojaPropia>
  );
}

function FormAprobacion({ id, ocInicial, cerrar }: { id: string; ocInicial: string | null; cerrar: () => void }) {
  const { correr, enviando, error } = useAccion();
  const [oc, setOc] = useState(ocInicial ?? "");
  const [monto, setMonto] = useState("");
  return (
    <div className="flex flex-col gap-4">
      <Campo etiqueta="Número de OC (Lebane)" htmlFor="oc"><Entrada id="oc" value={oc} onChange={(e) => setOc(e.target.value)} maxLength={40} inputMode="numeric" placeholder="Ej.: 3142" autoFocus /></Campo>
      <Campo etiqueta="Monto" htmlFor="monto" ayuda="Opcional. Lo ve el dueño al aprobar."><Entrada id="monto" value={monto} onChange={(e) => setMonto(e.target.value)} inputMode="decimal" placeholder="$" /></Campo>
      <MensajeError>{error}</MensajeError>
      <Boton ancho cargando={enviando} disabled={!oc.trim()} onClick={async () => (await correr(() => pedirAprobacion({ id, ordenCompra: oc, monto }), "Listo. Le llegó al dueño para aprobar.")) && cerrar()}>
        Pedir aprobación
      </Boton>
    </div>
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

type DatosHabilitarHoja = { id: string; proveedores: ProveedorConSucursales[]; oc: string | null; descripcion: string; destino: { lat: number; lng: number } | null };

/** APROBADO → "Habilitar para retirar". */
export function BotonHabilitar({ otraParte = false, ...d }: DatosHabilitarHoja & { otraParte?: boolean }) {
  return (
    <ConHojaPropia etiqueta={otraParte ? "Habilitar otra parte" : "Habilitar para retirar"} titulo="Habilitar para retirar" icono={<PackageOpen />} grande={!otraParte} variante={otraParte ? "secundario" : "primario"}>
      {(cerrar) => <FormHabilitar {...d} cerrar={cerrar} />}
    </ConHojaPropia>
  );
}

function FormHabilitar({ id, proveedores, oc, descripcion, destino, cerrar }: DatosHabilitarHoja & { cerrar: () => void }) {
  const { correr, enviando, error } = useAccion();
  const [prov, setProv] = useState<ValorProveedor>({ proveedorId: null, sucursalId: null });
  const [horario, setHorario] = useState("");
  const [contacto, setContacto] = useState("");
  const [ordenCompra, setOrdenCompra] = useState(oc ?? "");
  const [que, setQue] = useState(descripcion.replace(/\n/g, " · "));
  const [pesoKg, setPesoKg] = useState("");
  const [modo, setModo] = useState<"RETIRA_CHOFER" | "ENTREGA_PROVEEDOR">("RETIRA_CHOFER");
  const [fechaEstimada, setFechaEstimada] = useState(sumarDias(diaISO(), 1));
  const [completo, setCompleto] = useState(true);
  return (
    <div className="flex flex-col gap-4">
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
        ancho cargando={enviando} disabled={!prov.proveedorId || !prov.sucursalId || !pesoKg}
        onClick={async () =>
          (await correr(
            () => habilitarRetiro({ id, proveedorId: prov.proveedorId!, sucursalId: prov.sucursalId!, horario, contacto, ordenCompra, descripcion: que, pesoKg, modo, fechaEstimada: modo === "ENTREGA_PROVEEDOR" ? fechaEstimada : undefined, completo }),
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
