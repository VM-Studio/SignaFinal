"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Send, X } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Opciones } from "@/components/ui/opciones";
import { Campo, Entrada, Fecha, MensajeError, Selector } from "@/components/ui/campos";
import { useAviso } from "@/components/ui/avisos";
import { deshacerPedidoMaterial, pedirMateriales } from "@/lib/materiales/acciones";
import { diaISO, sumarDias } from "@/lib/formato";

type Obra = { id: string; nombre: string; personas?: { id: string; nombre: string }[] };

/**
 * Pedir materiales a Compras: obra, qué (un renglón por material), para cuándo y prioridad.
 * Entra en una pantalla. Compras lo usa igual para cargar lo que le piden por teléfono (elige quién lo pidió).
 */
export function FormularioMateriales({ obras, obraInicial, compras = false }: { obras: Obra[]; obraInicial?: string; compras?: boolean }) {
  const router = useRouter();
  const aviso = useAviso();
  const unaObra = obraInicial && obras.some((o) => o.id === obraInicial) ? obraInicial : obras.length === 1 ? obras[0].id : "";
  const [obraId, setObraId] = useState(unaObra);
  const [solicitanteId, setSolicitanteId] = useState(compras ? (obras.find((o) => o.id === unaObra)?.personas?.[0]?.id ?? "") : "");
  const [renglones, setRenglones] = useState<string[]>([""]);
  const hoy = diaISO();
  const [cuando, setCuando] = useState<"hoy" | "manana" | "fecha">("manana");
  const [fecha, setFecha] = useState(sumarDias(hoy, 2));
  const [prioridad, setPrioridad] = useState<"NORMAL" | "URGENTE">("NORMAL");
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);

  const personas = obras.find((o) => o.id === obraId)?.personas ?? [];
  const cambiarRenglon = (i: number, v: string) => setRenglones((r) => r.map((x, j) => (j === i ? v : x)));

  async function enviar() {
    setError(undefined);
    if (!obraId) return setError("Elegí la obra.");
    if (!renglones.some((r) => r.trim())) return setError("Escribí qué necesitás.");
    if (compras && !solicitanteId) return setError("Elegí quién lo pidió.");
    setEnviando(true);
    const r = await pedirMateriales({
      obraId, renglones, prioridad, solicitanteId: compras ? solicitanteId : undefined,
      dia: cuando === "hoy" ? hoy : cuando === "manana" ? sumarDias(hoy, 1) : fecha,
    });
    setEnviando(false);
    if (!r.ok) return setError(r.error);
    aviso({
      mensaje: compras ? `Pedido ${r.datos.numero} cargado. Ya está en Nuevos.` : "Pedido enviado a Compras. Te avisamos en cada paso.",
      deshacer: async () => {
        const x = await deshacerPedidoMaterial(r.datos.id);
        if (!x.ok) aviso({ mensaje: x.error, tono: "error" });
        router.refresh();
      },
    });
    router.push(compras ? `/compras/${r.datos.id}` : "/mis-pedidos?tab=materiales");
  }

  return (
    <div className="flex flex-col gap-3">
      {obras.length === 1 ? (
        <p className="rounded-[var(--radius-caja)] bg-papel px-4 py-3 font-semibold">Para Obra {obras[0].nombre}</p>
      ) : (
        <Campo etiqueta="Obra" htmlFor="obra">
          <Selector id="obra" value={obraId} onChange={(e) => { setObraId(e.target.value); setSolicitanteId(obras.find((o) => o.id === e.target.value)?.personas?.[0]?.id ?? ""); }}>
            {!unaObra && <option value="">Elegí la obra</option>}
            {obras.map((o) => <option key={o.id} value={o.id}>Obra {o.nombre}</option>)}
          </Selector>
        </Campo>
      )}
      {compras && obraId && (
        <Campo etiqueta="¿Quién lo pidió?" htmlFor="quien">
          <Selector id="quien" value={solicitanteId} onChange={(e) => setSolicitanteId(e.target.value)}>
            {personas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </Selector>
        </Campo>
      )}

      <div>
        <p className="mb-2 text-sm font-semibold">¿Qué necesitás?</p>
        <div className="flex flex-col gap-2">
          {renglones.map((r, i) => (
            <div key={i} className="flex gap-2">
              <Entrada
                aria-label={`Material ${i + 1}`} value={r} maxLength={200} autoFocus={i > 0}
                onChange={(e) => cambiarRenglon(i, e.target.value)}
                placeholder={i === 0 ? "Ej.: cemento portland, 50 bolsas" : "Otro material y cantidad"}
              />
              {renglones.length > 1 && (
                <button type="button" aria-label={`Sacar material ${i + 1}`} onClick={() => setRenglones((x) => x.filter((_, j) => j !== i))} className="grid size-[52px] shrink-0 place-items-center rounded-[var(--radius-caja)] border-2 border-linea hover:border-negro">
                  <X className="size-5" />
                </button>
              )}
            </div>
          ))}
        </div>
        {renglones.length < 20 && (
          <button type="button" onClick={() => setRenglones((x) => [...x, ""])} className="mt-2 inline-flex min-h-11 items-center gap-1.5 font-semibold underline">
            <Plus className="size-5" /> Otro material
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-semibold">¿Para cuándo?</p>
        <Opciones nombre="Para cuándo" columnas={3} valor={cuando} onElegir={(v) => setCuando(v as typeof cuando)} opciones={[{ valor: "hoy", titulo: "Hoy" }, { valor: "manana", titulo: "Mañana" }, { valor: "fecha", titulo: "Elegir" }]} />
        {cuando === "fecha" && <Fecha aria-label="Fecha" value={fecha} min={hoy} onChange={(e) => setFecha(e.target.value)} />}
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-semibold">Prioridad</p>
        <Opciones nombre="Prioridad" columnas={2} valor={prioridad} onElegir={(v) => setPrioridad(v as typeof prioridad)} opciones={[{ valor: "NORMAL", titulo: "Normal" }, { valor: "URGENTE", titulo: "Urgente" }]} />
        <p className="text-sm text-suave">Urgente solo si la obra se para sin esto.</p>
      </div>

      <MensajeError>{error}</MensajeError>
      <Boton ancho tamano="grande" cargando={enviando} onClick={enviar} icono={<Send className="size-5" />}>
        {compras ? "Cargar el pedido" : "Pedir a Compras"}
      </Boton>
    </div>
  );
}
