"use client";

import { useState, type ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Hoja } from "@/components/ui/hoja";
import { FormularioMateriales, type ObraParaPedir } from "@/components/materiales/formulario-materiales";
import { FormularioPedido } from "@/components/pedidos/formulario-pedido";
import type { Persona } from "@/components/obras/formulario-obra";
import type { DatosFormulario } from "@/lib/pedidos/consultas";
import type { Favorito, ItemHistorial, PrecargaMateriales, PrecargaViaje } from "@/lib/historial/consultas";
import { PanelHistorial } from "./panel";

type Historial = { items: ItemHistorial[]; favoritos: Favorito[] };

/**
 * Formulario + "Pedidos anteriores". Escritorio: formulario en 2/3 y el panel en el 1/3 derecho (360 px como mínimo). Celular: un
 * botón "Repetir un pedido anterior" arriba del formulario abre el panel como hoja inferior. Repetir
 * vuelve a montar el formulario con todo precargado (menos la fecha).
 */
function Marco({ panel, children, hayHistorial }: { panel: (cerrar: () => void) => ReactNode; children: ReactNode; hayHistorial: boolean }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)]">
      <div className="min-w-0">
        {hayHistorial && (
          <div className="mb-4 lg:hidden">
            <Boton variante="secundario" ancho icono={<RotateCcw />} onClick={() => setAbierta(true)}>Repetir un pedido anterior</Boton>
            <Hoja abierta={abierta} onCerrar={() => setAbierta(false)} titulo="Repetir un pedido anterior">{panel(() => setAbierta(false))}</Hoja>
          </div>
        )}
        {children}
      </div>
      <aside className="hidden min-w-0 lg:block">
        <div className="sticky top-[72px] max-h-[calc(100dvh-96px)] overflow-y-auto rounded-[var(--radius-caja)] border border-linea bg-papel p-4">{panel(() => {})}</div>
      </aside>
    </div>
  );
}

export function MaterialesConHistorial({ historial, precargaInicial = null, todas = false, verBase, ...form }: {
  historial: Historial; precargaInicial?: PrecargaMateriales | null; todas?: boolean; verBase: string;
  obras: ObraParaPedir[]; obraInicial?: string; compras?: boolean; puedeCrearObra?: boolean; responsables?: Persona[];
}) {
  const [precarga, setPrecarga] = useState<PrecargaMateriales | null>(precargaInicial);
  const [vuelta, setVuelta] = useState(0);
  return (
    <Marco
      hayHistorial={historial.items.length > 0 || historial.favoritos.length > 0}
      panel={(cerrar) => (
        <PanelHistorial tipo="MATERIALES" inicial={historial.items} favoritos={historial.favoritos} todas={todas} verHref={(id) => `${verBase}/${id}`}
          onRepetir={(p) => { setPrecarga(p as PrecargaMateriales); setVuelta((v) => v + 1); cerrar(); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
      )}
    >
      <FormularioMateriales key={`${precarga?.origen.id ?? "nuevo"}-${vuelta}`} {...form} precarga={precarga} />
    </Marco>
  );
}

export function ViajeConHistorial({ historial, datos, obraInicial, precargaInicial = null }: { historial: Historial; datos: DatosFormulario; obraInicial?: string; precargaInicial?: PrecargaViaje | null }) {
  const [precarga, setPrecarga] = useState<PrecargaViaje | null>(precargaInicial);
  const [vuelta, setVuelta] = useState(0);
  return (
    <Marco
      hayHistorial={historial.items.length > 0 || historial.favoritos.length > 0}
      panel={(cerrar) => (
        <PanelHistorial tipo="VIAJE" inicial={historial.items} favoritos={historial.favoritos} verHref={(id) => `/mis-pedidos/${id}`}
          onRepetir={(p) => { setPrecarga(p as PrecargaViaje); setVuelta((v) => v + 1); cerrar(); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
      )}
    >
      <FormularioPedido key={`${precarga?.origen.id ?? "nuevo"}-${vuelta}`} datos={datos} obraInicial={obraInicial} precarga={precarga} />
    </Marco>
  );
}
