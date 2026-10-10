"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Send, X } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Opciones } from "@/components/ui/opciones";
import { AreaTexto, Campo, Entrada, Fecha, MensajeError, Selector } from "@/components/ui/campos";
import { Combobox } from "@/components/ui/combobox";
import { useAviso } from "@/components/ui/avisos";
import { SubirAdjuntos } from "@/components/adjuntos/subir";
import { NuevaObra, type ObraCreada, type Persona } from "@/components/obras/formulario-obra";
import { deshacerPedidoMaterial, pedirMateriales } from "@/lib/materiales/acciones";
import { diaISO, sumarDias } from "@/lib/formato";

export type ObraParaPedir = { id: string; nombre: string; localidad: string; sedes: { id: string; nombre: string }[]; personas?: Persona[] };
type Renglon = { descripcion: string; cantidad: string; unidad: string };

const UNIDADES = ["u", "bolsas", "m", "m²", "m³", "kg", "barras", "rollos", "cajas", "litros", "pallets"];
const VACIO: Renglon = { descripcion: "", cantidad: "", unidad: "u" };

/**
 * Pedir materiales a Compras: obra (con buscador, y "Nueva obra" para quien puede cargarlas), sede si la
 * obra tiene varias, materiales como renglones y/o archivos adjuntos (con uno alcanza), observaciones,
 * para cuándo y prioridad. En el celular va en dos pasos: lo que se pide y después los detalles.
 * Compras lo usa igual para cargar lo que le piden por teléfono (elige quién lo pidió).
 */
export function FormularioMateriales({ obras: iniciales, obraInicial, compras = false, puedeCrearObra = false, responsables = [] }: {
  obras: ObraParaPedir[]; obraInicial?: string; compras?: boolean; puedeCrearObra?: boolean; responsables?: Persona[];
}) {
  const router = useRouter();
  const aviso = useAviso();
  const [obras, setObras] = useState(iniciales);
  const unaObra = obraInicial && obras.some((o) => o.id === obraInicial) ? obraInicial : obras.length === 1 ? obras[0].id : null;
  const [obraId, setObraId] = useState<string | null>(unaObra);
  const obra = obras.find((o) => o.id === obraId) ?? null;
  const [sedeId, setSedeId] = useState("");
  const [solicitanteId, setSolicitanteId] = useState(compras ? (obra?.personas?.[0]?.id ?? "") : "");
  const [renglones, setRenglones] = useState<Renglon[]>([VACIO]);
  const [adjuntos, setAdjuntos] = useState<string[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [observaciones, setObservaciones] = useState("");
  const hoy = diaISO();
  const [cuando, setCuando] = useState<"hoy" | "manana" | "fecha">("manana");
  const [fecha, setFecha] = useState(sumarDias(hoy, 2));
  const [prioridad, setPrioridad] = useState<"NORMAL" | "URGENTE">("NORMAL");
  const [paso, setPaso] = useState<1 | 2>(1);
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);

  const items = useMemo(() => obras.map((o) => ({ id: o.id, titulo: `Obra ${o.nombre}`, detalle: o.localidad, buscar: o.sedes.map((s) => s.nombre).join(" ") })), [obras]);
  const hayMateriales = renglones.some((r) => r.descripcion.trim()) || adjuntos.length > 0;
  const cambiar = (i: number, c: Partial<Renglon>) => setRenglones((r) => r.map((x, j) => (j === i ? { ...x, ...c } : x)));

  function elegirObra(id: string | null) {
    setObraId(id);
    setSedeId("");
    setSolicitanteId(obras.find((o) => o.id === id)?.personas?.[0]?.id ?? "");
  }

  /** Lo mínimo del primer paso: obra (y sede si hace falta) y qué se pide. */
  function validarPaso1() {
    if (!obra) return "Elegí la obra.";
    if (obra.sedes.length > 1 && !sedeId) return "Elegí la sede.";
    if (compras && !solicitanteId) return "Elegí quién lo pidió.";
    if (!hayMateriales) return "Escribí qué necesitás o adjuntá la lista de materiales.";
    if (subiendo) return "Esperá a que terminen de subir los archivos.";
    return undefined;
  }

  async function enviar() {
    const e = validarPaso1();
    setError(e);
    if (e) return;
    setEnviando(true);
    const r = await pedirMateriales({
      obraId: obra!.id, obraSedeId: sedeId || (obra!.sedes.length === 1 ? obra!.sedes[0].id : undefined),
      renglones: renglones.map((x) => ({ descripcion: x.descripcion, cantidad: x.cantidad.replace(",", "."), unidad: x.cantidad ? x.unidad : "" })),
      adjuntos, observaciones, prioridad, solicitanteId: compras ? solicitanteId : undefined,
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
    <div className="flex flex-col gap-4">
      {/* ── Paso 1: obra y materiales (en escritorio, todo junto) ── */}
      <div className={`flex flex-col gap-4 ${paso === 2 ? "hidden lg:flex" : ""}`}>
        <p className="etiqueta lg:hidden">Paso 1 de 2 · Qué y para dónde</p>
        {obras.length === 1 && !puedeCrearObra ? (
          <p className="rounded-md border border-linea bg-papel px-3 py-2 text-sm font-medium">Para Obra {obras[0].nombre} · {obras[0].localidad}</p>
        ) : (
          <Combobox
            etiqueta="Obra"
            placeholder="Buscar por nombre o localidad"
            items={items}
            valor={obraId}
            onElegir={elegirObra}
            vacio="No hay obras con ese nombre."
            accion={puedeCrearObra ? (
              <NuevaObra chico responsables={responsables} onCreada={(o: ObraCreada) => {
                setObras((xs) => [...xs, { id: o.id, nombre: o.nombre, localidad: o.localidad, sedes: [], personas: [] }].sort((a, b) => a.nombre.localeCompare(b.nombre)));
                elegirObra(o.id);
              }} />
            ) : undefined}
          />
        )}
        {obra && obra.sedes.length > 1 && (
          <Campo etiqueta="Sede" htmlFor="sede">
            <Selector id="sede" value={sedeId} onChange={(e) => setSedeId(e.target.value)}>
              <option value="">Elegí la sede</option>
              {obra.sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </Selector>
          </Campo>
        )}
        {compras && obra && (
          <Campo etiqueta="¿Quién lo pidió?" htmlFor="quien">
            <Selector id="quien" value={solicitanteId} onChange={(e) => setSolicitanteId(e.target.value)}>
              {(obra.personas ?? []).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </Selector>
          </Campo>
        )}

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-[12px] font-medium text-suave">Materiales (escribilos o adjuntá la lista: con uno alcanza)</legend>
          {renglones.map((r, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_5.5rem_6.5rem_auto]">
              <Entrada aria-label={`Material ${i + 1}`} value={r.descripcion} maxLength={200} autoFocus={i > 0} onChange={(e) => cambiar(i, { descripcion: e.target.value })} placeholder={i === 0 ? "Ej.: cemento portland" : "Otro material"} className="sm:col-span-1" />
              {renglones.length > 1 ? (
                <button type="button" aria-label={`Sacar material ${i + 1}`} onClick={() => setRenglones((x) => x.filter((_, j) => j !== i))} className="grid size-11 place-items-center rounded-md border border-linea text-suave hover:text-tinta sm:order-last lg:size-9">
                  <X className="size-4" />
                </button>
              ) : <span className="sm:order-last sm:w-9" />}
              <div className="col-span-2 grid grid-cols-2 gap-2 sm:col-span-2 sm:contents">
                <Entrada aria-label={`Cantidad del material ${i + 1}`} inputMode="decimal" value={r.cantidad} onChange={(e) => cambiar(i, { cantidad: e.target.value.replace(/[^\d.,]/g, "") })} placeholder="Cantidad" />
                <Selector aria-label={`Unidad del material ${i + 1}`} value={r.unidad} onChange={(e) => cambiar(i, { unidad: e.target.value })}>
                  {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
                </Selector>
              </div>
            </div>
          ))}
          {renglones.length < 50 && (
            <Boton variante="fantasma" tamano="chico" icono={<Plus />} onClick={() => setRenglones((x) => [...x, VACIO])} className="self-start">Agregar material</Boton>
          )}
          <SubirAdjuntos entidadTipo="PEDIDO_MATERIAL" etiqueta="Adjuntar lista de materiales" onCambio={(ids, s) => { setAdjuntos(ids); setSubiendo(s); }} />
          <p className="text-[12px] text-suave">PDF, Excel, Word, CSV o fotos (hasta 20 MB cada uno). Se pueden adjuntar varios.</p>
        </fieldset>
      </div>

      {/* ── Paso 2: detalles ── */}
      <div className={`flex flex-col gap-4 ${paso === 1 ? "hidden lg:flex" : ""}`}>
        <div className="flex items-center gap-2 lg:hidden">
          <button type="button" onClick={() => setPaso(1)} aria-label="Volver al paso 1" className="-ml-2 grid size-10 place-items-center rounded-md hover:bg-black/[0.04]"><ArrowLeft className="size-5" /></button>
          <p className="etiqueta">Paso 2 de 2 · Detalles</p>
        </div>
        <Campo etiqueta="Observaciones (opcional)" htmlFor="obs">
          <AreaTexto id="obs" rows={4} maxLength={2000} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Notas para Compras: marca, urgencia, dónde descargar, a quién avisar…" />
        </Campo>
        <div className="flex flex-col gap-1.5">
          <p className="text-[12px] font-medium text-suave">¿Para cuándo?</p>
          <Opciones nombre="Para cuándo" columnas={3} valor={cuando} onElegir={(v) => setCuando(v as typeof cuando)} opciones={[{ valor: "hoy", titulo: "Hoy" }, { valor: "manana", titulo: "Mañana" }, { valor: "fecha", titulo: "Elegir" }]} />
          {cuando === "fecha" && <Fecha aria-label="Fecha" value={fecha} min={hoy} onChange={(e) => setFecha(e.target.value)} />}
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-[12px] font-medium text-suave">Prioridad</p>
          <Opciones nombre="Prioridad" columnas={2} valor={prioridad} onElegir={(v) => setPrioridad(v as typeof prioridad)} opciones={[{ valor: "NORMAL", titulo: "Normal" }, { valor: "URGENTE", titulo: "Urgente" }]} />
          <p className="text-[12px] text-suave">Urgente solo si la obra se para sin esto.</p>
        </div>
      </div>

      <MensajeError>{error}</MensajeError>
      {paso === 1 && (
        <div className="lg:hidden"><Boton ancho onClick={() => { const e = validarPaso1(); setError(e); if (!e) setPaso(2); }}>Siguiente</Boton></div>
      )}
      <div className={paso === 1 ? "hidden lg:block" : ""}>
        <Boton ancho cargando={enviando} disabled={subiendo} onClick={enviar} icono={<Send />}>
          {subiendo ? "Subiendo archivos…" : compras ? "Cargar el pedido" : "Pedir a Compras"}
        </Boton>
      </div>
    </div>
  );
}
