"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SelectorProveedorSucursal, type ValorProveedor } from "@/components/proveedores/selector";
import type { ProveedorConSucursales } from "@/lib/proveedores/acciones";
import { Boton } from "@/components/ui/boton";
import { Opciones } from "@/components/ui/opciones";
import { Campo, Entrada, Fecha, MensajeError } from "@/components/ui/campos";
import { useAviso } from "@/components/ui/avisos";
import type { Resultado } from "@/lib/resultado";
import { habilitarRetiro } from "@/lib/materiales/acciones";
import { PESOS_MATERIAL } from "@/lib/compras/documento";
import { diaISO, sumarDias } from "@/lib/formato";

/**
 * HOJA "HABILITAR PARA RETIRAR" (Compras, desde la barra de la orden autorizada): sucursal del proveedor
 * confirmada (adonde va el chofer), horario, contacto, qué parte (renglones del detalle), peso, y si lo
 * retira un chofer o lo entrega el proveedor. Al habilitar, la orden queda HABILITADA y al que pidió le
 * llega "Listo para retirar" con "Pedir el viaje".
 */
function useAccion() {
  const router = useRouter();
  const aviso = useAviso();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string>();
  async function correr(fn: () => Promise<Resultado<unknown>>, mensaje: string) {
    setEnviando(true);
    setError(undefined);
    const r = await fn();
    setEnviando(false);
    if (!r.ok) {
      setError(r.error);
      return false;
    }
    aviso({ mensaje });
    router.refresh();
    return true;
  }
  return { correr, enviando, error };
}

type RenglonOC = { descripcion: string; cantidad: number; unidad: string };
export type DatosHabilitarHoja = {
  id: string; proveedores: ProveedorConSucursales[]; oc: string | null; descripcion: string; destino: { lat: number; lng: number } | null;
  /** Con OC aprobada en el sistema: proveedor, sucursal, número y renglones vienen cargados. */
  ocAprobada?: { proveedorId: string | null; sucursalId: string | null; numero: string | null; renglones: RenglonOC[] } | null;
};

export function FormHabilitar({ id, proveedores, oc, descripcion, destino, ocAprobada, cerrar }: DatosHabilitarHoja & { cerrar: () => void }) {
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
      {ocAprobada?.numero && <p className="rounded-md bg-ok-fondo px-3 py-2 text-sm text-ok">Datos de la {ocAprobada.numero} autorizada: confirmá la sucursal y qué parte se habilita.</p>}
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
      <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
        <Campo etiqueta="¿Qué se retira?" htmlFor="que"><Entrada id="que" value={que} onChange={(e) => setQue(e.target.value)} maxLength={300} /></Campo>
        <Campo etiqueta="Nro OC" htmlFor="oc-h"><Entrada id="oc-h" value={ordenCompra} onChange={(e) => setOrdenCompra(e.target.value)} maxLength={40} /></Campo>
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold">Peso aproximado</p>
        <Opciones nombre="Peso" columnas={2} valor={pesoKg} onElegir={setPesoKg} opciones={PESOS_MATERIAL.map((p) => ({ valor: String(p.kg), titulo: p.titulo }))} />
      </div>
      <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-[var(--radius-caja)] border border-linea bg-papel px-4">
        <input type="checkbox" checked={completo} onChange={(e) => setCompleto(e.target.checked)} className="size-6 accent-negro" />
        <span className="font-semibold">Con esto no falta nada de la orden</span>
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

