"use client";

import { useState } from "react";
import { ArrowLeft, RotateCcw, UserRound } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Hoja } from "@/components/ui/hoja";
import { PanelHistorial } from "@/components/historial/panel";
import type { Favorito, ItemHistorial, PrecargaViaje } from "@/lib/historial/consultas";
import { Combobox } from "@/components/ui/combobox";
import { Selector } from "@/components/ui/campos";
import { FormularioPedido } from "./formulario-pedido";
import { RetiroMateriales } from "@/components/materiales/retiro-materiales";
import type { DatosFormulario } from "@/lib/pedidos/consultas";
import type { ListoParaRetirar } from "@/lib/materiales/consultas";

type Obra = { id: string; nombre: string; personas: { id: string; nombre: string }[] };

/**
 * COORDINAR VIAJE (Compras): el formulario de pedir viaje, con un primer campo "Para quién": la obra
 * (todas) y el responsable (los de esa obra). El pedido sale a nombre de esa persona y queda "coordinó"
 * Compras; los avisos del viaje les llegan a las dos. "Retiro en proveedor" muestra lo habilitado de
 * esa obra, igual que lo ve la arquitecta. A la derecha (2/3 + 1/3), "Pedidos anteriores": los que
 * coordinó, para repetirlos (en el celular, una hoja inferior).
 */
export function CoordinarViaje({ datos, obras, listos, historial }: { datos: DatosFormulario; obras: Obra[]; listos: Record<string, ListoParaRetirar[]>; historial: { items: ItemHistorial[]; favoritos: Favorito[] } }) {
  const [obraId, setObraId] = useState<string | null>(null);
  const [personaId, setPersonaId] = useState("");
  const [retiro, setRetiro] = useState(false);
  const [precarga, setPrecarga] = useState<PrecargaViaje | null>(null);
  const [vuelta, setVuelta] = useState(0);
  const [hoja, setHoja] = useState(false);
  const hayHistorial = historial.items.length > 0 || historial.favoritos.length > 0;
  const repetir = (p: PrecargaViaje) => {
    const o = obras.find((x) => x.id === p.obraId);
    if (o) {
      setObraId(o.id);
      if (!o.personas.some((x) => x.id === personaId)) setPersonaId(o.personas[0]?.id ?? "");
    }
    setRetiro(false);
    setPrecarga(p);
    setVuelta((v) => v + 1);
    setHoja(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const panel = (
    <PanelHistorial tipo="VIAJE" inicial={historial.items} favoritos={historial.favoritos} verHref={(id) => `/solicitudes/${id}`}
      onRepetir={(p) => repetir(p as PrecargaViaje)} />
  );
  const obra = obras.find((o) => o.id === obraId) ?? null;
  const persona = obra?.personas.find((p) => p.id === personaId) ?? null;
  const volver = "/compras/viajes/solicitudes";

  return (
    <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)]">
    <div className="flex min-w-0 flex-col gap-4">
      {hayHistorial && (
        <div className="lg:hidden">
          <Boton variante="secundario" ancho icono={<RotateCcw />} onClick={() => setHoja(true)}>Repetir un viaje anterior</Boton>
          <Hoja abierta={hoja} onCerrar={() => setHoja(false)} titulo="Repetir un viaje anterior">{panel}</Hoja>
        </div>
      )}
      <section className="flex flex-col gap-3 rounded-[var(--radius-caja)] border border-linea bg-papel p-4">
        <p className="flex items-center gap-2 text-[15px] font-semibold"><UserRound className="size-4" /> Para quién</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Combobox etiqueta="Obra" placeholder="Buscar obra" valor={obraId} onElegir={(id) => { setObraId(id); const o = obras.find((x) => x.id === id); setPersonaId(o?.personas[0]?.id ?? ""); setRetiro(false); }} items={obras.map((o) => ({ id: o.id, titulo: `Obra ${o.nombre}` }))} />
          <label className="flex flex-col gap-1 text-[12px] font-medium text-suave">
            Responsable
            <Selector value={personaId} disabled={!obra} onChange={(e) => setPersonaId(e.target.value)}>
              {!obra && <option value="">Primero la obra</option>}
              {obra && obra.personas.length === 0 && <option value="">La obra no tiene responsables</option>}
              {obra?.personas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </Selector>
          </label>
        </div>
        {persona && <p className="text-sm text-suave">El pedido sale a nombre de <b className="font-medium text-tinta">{persona.nombre.replace(" (capataz)", "")}</b>; vos quedás como quien lo coordinó y les llegan los avisos a los dos.</p>}
      </section>

      {obra && persona && (retiro ? (
        <div className="flex flex-col gap-3">
          <button type="button" onClick={() => setRetiro(false)} className="inline-flex min-h-9 items-center gap-1 self-start text-sm font-medium text-suave hover:text-tinta"><ArrowLeft className="size-4" /> Otro tipo de viaje</button>
          <RetiroMateriales key={`${obra.id}-${persona.id}`} obras={[{ id: obra.id, nombre: obra.nombre }]} listos={{ [obra.id]: listos[obra.id] ?? [] }} obraInicial={obra.id}
            coordinar={{ paraUsuarioId: persona.id, para: persona.nombre, volver }} />
        </div>
      ) : (
        <FormularioPedido key={`${obra.id}-${persona.id}-${vuelta}`} datos={{ ...datos, obras: datos.obras.filter((o) => o.id === obra.id) }} obraInicial={obra.id}
          precarga={precarga?.obraId === obra.id ? precarga : null}
          coordinar={{ paraUsuarioId: persona.id, para: persona.nombre.replace(" (capataz)", ""), onRetiro: () => setRetiro(true), volver }} />
      ))}
    </div>
    <aside className="hidden min-w-0 lg:block">
      <div className="sticky top-[calc(var(--alto-header)+24px)] max-h-[calc(100dvh-var(--alto-header)-48px)] overflow-y-auto rounded-[var(--radius-caja)] border border-linea bg-papel p-4">{panel}</div>
    </aside>
    </div>
  );
}
