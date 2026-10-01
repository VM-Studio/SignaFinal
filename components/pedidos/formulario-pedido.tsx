"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CloudOff, Send } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Opciones } from "@/components/ui/opciones";
import { AreaTexto, Campo, Entrada, MensajeError } from "@/components/ui/campos";
import { useAviso } from "@/components/ui/avisos";
import { usePanel } from "@/components/ui/panel";
import { crearPedido, type DatosPedido } from "@/lib/acciones/pedidos";
import { enviarOGuardar } from "@/lib/offline/cola";
import { TIPO_CARGA } from "@/lib/etiquetas";
import { peso as fmtPeso } from "@/lib/formato";

export type DatosFormularioPedido = {
  obras: { id: string; nombre: string; direccion: string }[];
  proveedores: { id: string; nombre: string; rubro: string | null; direccion: string }[];
  ordenes: { id: string; numero: string; descripcion: string; pesoEstimadoKg: number | null; obraId: string; proveedorId: string; proveedor: string }[];
  lugares: string[]; // "Depósito Signa", "Cochera Martínez"
  capacidades: { kg: number; vehiculos: string }[];
};

type Origen = { tipo: "oc"; id: string } | { tipo: "proveedor"; id: string } | { tipo: "lugar"; texto: string };
type Cuando = "URGENTE" | "HOY" | "MANANA" | "SIN_APURO";

const PASOS = ["Obra", "Desde dónde", "Qué", "Peso y urgencia", "Confirmar"] as const;

function fechaDe(c: Cuando) {
  if (c === "SIN_APURO") return undefined;
  const d = new Date();
  if (c === "MANANA") d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function FormularioPedido({ datos }: { datos: DatosFormularioPedido }) {
  const router = useRouter();
  const aviso = useAviso();
  const panel = usePanel();
  const unaSolaObra = datos.obras.length === 1;

  const [paso, setPaso] = useState(unaSolaObra ? 1 : 0);
  const [obraId, setObraId] = useState<string | undefined>(unaSolaObra ? datos.obras[0].id : undefined);
  const [modoOrigen, setModoOrigen] = useState<"oc" | "proveedor" | "lugar">("oc");
  const [origen, setOrigen] = useState<Origen | undefined>();
  const [tipoCarga, setTipoCarga] = useState<string>("MATERIALES");
  const [descripcion, setDescripcion] = useState("");
  const [pesoKg, setPesoKg] = useState<string>("");
  const [cuando, setCuando] = useState<Cuando>("HOY");
  const [observaciones, setObservaciones] = useState("");
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<"enviado" | "guardado">();

  const obra = datos.obras.find((o) => o.id === obraId);
  const ordenesObra = useMemo(() => datos.ordenes.filter((o) => o.obraId === obraId), [datos.ordenes, obraId]);
  const modo = modoOrigen === "oc" && ordenesObra.length === 0 ? "proveedor" : modoOrigen;

  const textoOrigen = (() => {
    if (!origen) return "";
    if (origen.tipo === "oc") {
      const oc = datos.ordenes.find((o) => o.id === origen.id);
      return oc ? `${oc.proveedor} (${oc.numero})` : "";
    }
    if (origen.tipo === "proveedor") return datos.proveedores.find((p) => p.id === origen.id)?.nombre ?? "";
    return origen.texto;
  })();

  function elegirOrigen(o: Origen) {
    setOrigen(o);
    if (o.tipo === "oc") {
      const oc = datos.ordenes.find((x) => x.id === o.id);
      if (oc) {
        setDescripcion(oc.descripcion);
        setTipoCarga("MATERIALES");
        if (oc.pesoEstimadoKg) {
          const tramo = datos.capacidades.find((c) => c.kg >= oc.pesoEstimadoKg!);
          setPesoKg(String(tramo?.kg ?? datos.capacidades.at(-1)?.kg ?? ""));
        }
      }
    }
    setPaso(2);
  }

  function puedeSeguir() {
    if (paso === 0) return !!obraId;
    if (paso === 1) return !!origen;
    if (paso === 2) return descripcion.trim().length >= 3;
    return true;
  }

  async function enviar() {
    if (!obraId || !origen) return;
    setError(undefined);
    setEnviando(true);
    const entrada: DatosPedido = {
      clientId: crypto.randomUUID(),
      obraId,
      proveedorId:
        origen.tipo === "proveedor" ? origen.id : origen.tipo === "oc" ? datos.ordenes.find((o) => o.id === origen.id)?.proveedorId : undefined,
      ordenCompraId: origen.tipo === "oc" ? origen.id : undefined,
      origenTexto: origen.tipo === "lugar" ? origen.texto : undefined,
      tipoCarga: tipoCarga as DatosPedido["tipoCarga"],
      descripcion: descripcion.trim(),
      pesoKg: pesoKg ? Number(pesoKg) : undefined,
      prioridad: cuando === "URGENTE" ? "URGENTE" : "NORMAL",
      necesarioPara: fechaDe(cuando),
      observaciones: observaciones.trim() || undefined,
    };
    const r = await enviarOGuardar("pedido.crear", `Pedido para Obra ${obra?.nombre}`, entrada, () => crearPedido(entrada));
    setEnviando(false);
    if (r.estado === "error") {
      setError(r.error);
      return;
    }
    if (r.estado === "enviado") {
      aviso({ mensaje: `Listo. El pedido ${r.datos.numero} está en la cola.` });
      if (panel.enPanel) {
        panel.cerrar();
        router.refresh();
      } else {
        router.push(`/pedidos/${r.datos.id}`);
      }
      return;
    }
    setResultado("guardado");
  }

  if (resultado === "guardado") {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <CloudOff className="size-12" />
        <h2 className="text-xl font-bold">Guardado en el teléfono</h2>
        <p className="max-w-sm text-suave">No hay señal. El pedido se manda solo cuando vuelva; arriba vas a ver el aviso hasta que salga.</p>
        <Boton ancho onClick={() => (panel.enPanel ? panel.cerrar() : router.push("/inicio"))}>Volver al inicio</Boton>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-14rem)] flex-col lg:min-h-0">
      {/* Progreso */}
      <div className="mb-4 flex items-center gap-3">
        {paso > (unaSolaObra ? 1 : 0) && (
          <button type="button" onClick={() => setPaso(paso - 1)} aria-label="Volver al paso anterior" className="-ml-2 grid size-11 place-items-center rounded-md hover:bg-black/5">
            <ArrowLeft className="size-6" />
          </button>
        )}
        <div className="flex-1">
          <p className="text-sm font-semibold text-suave">
            Paso {paso + 1 - (unaSolaObra ? 1 : 0)} de {PASOS.length - (unaSolaObra ? 1 : 0)}
          </p>
          <div className="mt-1.5 flex gap-1">
            {PASOS.slice(unaSolaObra ? 1 : 0).map((p, i) => (
              <span key={p} className={`h-1 flex-1 rounded-full ${i <= paso - (unaSolaObra ? 1 : 0) ? "bg-negro" : "bg-linea"}`} />
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1">
        {paso === 0 && (
          <>
            <h2 className="mb-3 text-xl font-bold">¿Para qué obra?</h2>
            <Opciones
              nombre="Obra"
              valor={obraId}
              onElegir={(v) => {
                setObraId(v);
                setOrigen(undefined);
                setPaso(1);
              }}
              opciones={datos.obras.map((o) => ({ valor: o.id, titulo: `Obra ${o.nombre}`, detalle: o.direccion }))}
            />
          </>
        )}

        {paso === 1 && (
          <>
            <h2 className="mb-1 text-xl font-bold">¿De dónde hay que buscarlo?</h2>
            <p className="mb-3 text-suave">Para Obra {obra?.nombre}</p>
            <div className="mb-3 grid grid-cols-3 gap-1 rounded-[var(--radius-caja)] bg-black/5 p-1">
              {(
                [
                  ["oc", "Orden de compra"],
                  ["proveedor", "Proveedor"],
                  ["lugar", "Otro lugar"],
                ] as const
              ).map(([m, t]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setModoOrigen(m)}
                  disabled={m === "oc" && ordenesObra.length === 0}
                  className={`min-h-11 rounded-md px-1 text-sm font-semibold disabled:opacity-40 ${modo === m ? "bg-papel shadow-[0_0_0_1px_var(--color-linea)]" : "text-suave"}`}
                >
                  {t}
                </button>
              ))}
            </div>
            {modo === "oc" && (
              <Opciones
                nombre="Orden de compra"
                valor={origen?.tipo === "oc" ? origen.id : undefined}
                onElegir={(v) => elegirOrigen({ tipo: "oc", id: v })}
                opciones={ordenesObra.map((o) => ({
                  valor: o.id,
                  titulo: `${o.proveedor} · ${o.numero}`,
                  detalle: `${o.descripcion}${o.pesoEstimadoKg ? ` · ${fmtPeso(o.pesoEstimadoKg)}` : ""}`,
                }))}
              />
            )}
            {modo === "proveedor" && (
              <Opciones
                nombre="Proveedor"
                valor={origen?.tipo === "proveedor" ? origen.id : undefined}
                onElegir={(v) => elegirOrigen({ tipo: "proveedor", id: v })}
                opciones={datos.proveedores.map((p) => ({ valor: p.id, titulo: p.nombre, detalle: [p.rubro, p.direccion].filter(Boolean).join(" · ") }))}
              />
            )}
            {modo === "lugar" && (
              <Opciones
                nombre="Lugar"
                valor={origen?.tipo === "lugar" ? origen.texto : undefined}
                onElegir={(v) => elegirOrigen({ tipo: "lugar", texto: v })}
                opciones={[
                  ...datos.lugares.map((l) => ({ valor: l, titulo: l })),
                  ...datos.obras.filter((o) => o.id !== obraId).map((o) => ({ valor: `Obra ${o.nombre}`, titulo: `Obra ${o.nombre}`, detalle: o.direccion })),
                ]}
              />
            )}
          </>
        )}

        {paso === 2 && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="mb-3 text-xl font-bold">¿Qué hay que llevar?</h2>
              <Opciones
                nombre="Tipo de carga"
                columnas={2}
                valor={tipoCarga}
                onElegir={setTipoCarga}
                opciones={Object.entries(TIPO_CARGA).map(([valor, titulo]) => ({ valor, titulo }))}
              />
            </div>
            <Campo etiqueta="Detalle" htmlFor="descripcion" ayuda="Ej.: 40 bolsas de cemento, hormigonera chica.">
              <Entrada id="descripcion" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} maxLength={300} autoComplete="off" />
            </Campo>
          </div>
        )}

        {paso === 3 && (
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="mb-3 text-xl font-bold">¿Cuánto pesa, más o menos?</h2>
              <Opciones
                nombre="Peso"
                columnas={2}
                valor={pesoKg}
                onElegir={setPesoKg}
                opciones={[
                  ...datos.capacidades.map((c) => ({ valor: String(c.kg), titulo: `Hasta ${fmtPeso(c.kg)}`, detalle: c.vehiculos })),
                  { valor: "", titulo: "No sé", detalle: "Lo ve el chofer" },
                ]}
              />
            </div>
            <div>
              <h2 className="mb-3 text-xl font-bold">¿Para cuándo?</h2>
              <Opciones
                nombre="Para cuándo"
                columnas={2}
                valor={cuando}
                onElegir={(v) => setCuando(v as Cuando)}
                opciones={[
                  { valor: "URGENTE", titulo: "Urgente", detalle: "Hay gente parada" },
                  { valor: "HOY", titulo: "Hoy" },
                  { valor: "MANANA", titulo: "Mañana" },
                  { valor: "SIN_APURO", titulo: "Sin apuro" },
                ]}
              />
            </div>
          </div>
        )}

        {paso === 4 && (
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-bold">Revisá y pedí</h2>
            <dl className="divide-y divide-linea rounded-[var(--radius-caja)] border border-linea bg-papel">
              {[
                ["Obra", `Obra ${obra?.nombre}`],
                ["Desde", textoOrigen],
                ["Qué", `${TIPO_CARGA[tipoCarga as keyof typeof TIPO_CARGA]}: ${descripcion}`],
                ["Peso", pesoKg ? `Hasta ${fmtPeso(Number(pesoKg))}` : "No sé"],
                ["Cuándo", { URGENTE: "Urgente", HOY: "Hoy", MANANA: "Mañana", SIN_APURO: "Sin apuro" }[cuando]],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-3 px-4 py-2.5">
                  <dt className="w-16 shrink-0 text-sm font-semibold text-suave">{k}</dt>
                  <dd className="min-w-0 font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            <Campo etiqueta="Observaciones (opcional)" htmlFor="obs">
              <AreaTexto id="obs" rows={2} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} maxLength={500} placeholder="Ej.: preguntar por Juan en el corralón" />
            </Campo>
            <MensajeError>{error}</MensajeError>
          </div>
        )}
      </div>

      {paso >= 2 && (
        <div className="sticky bottom-[calc(72px+env(safe-area-inset-bottom))] mt-5 bg-fondo pt-2 pb-1 lg:static">
          {paso < 4 ? (
            <Boton ancho tamano="grande" disabled={!puedeSeguir()} onClick={() => setPaso(paso + 1)}>
              Siguiente
            </Boton>
          ) : (
            <Boton ancho tamano="grande" cargando={enviando} onClick={enviar} icono={<Send className="size-5" />}>
              Pedir el viaje
            </Boton>
          )}
        </div>
      )}
    </div>
  );
}
