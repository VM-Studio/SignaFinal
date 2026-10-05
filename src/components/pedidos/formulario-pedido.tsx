"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Copy, Search, Send } from "lucide-react";
import type { OrigenTipo, TipoPedido } from "@prisma/client";
import { Boton } from "@/components/ui/boton";
import { Opciones } from "@/components/ui/opciones";
import { Campo, Entrada, Fecha, MensajeError, Selector } from "@/components/ui/campos";
import { Hoja } from "@/components/ui/hoja";
import { useAviso } from "@/components/ui/avisos";
import { crearPedido, deshacerPedido, type DatosPedido } from "@/lib/pedidos/acciones";
import { enviarOGuardar } from "@/lib/offline/cola";
import { CloudOff } from "lucide-react";
import type { Duplicado } from "@/lib/pedidos/reglas";
import { PESOS, TIPO, TIPOS_PARA_PEDIR, VOLUMEN_ESCOMBROS } from "@/lib/pedidos/presentacion";
import { diaISO, sumarDias } from "@/lib/formato";
import type { DatosFormulario } from "@/lib/pedidos/consultas";
import { IconoTipo } from "./iconos";

type Lugar = { tipo: OrigenTipo; id: string };
const clave = (l?: Lugar) => (l ? `${l.tipo}:${l.id}` : "");
const deClave = (k: string): Lugar | undefined => (k ? { tipo: k.split(":")[0] as OrigenTipo, id: k.split(":")[1] } : undefined);

/** "Paso 1 ¿Qué hay que hacer? → Paso 2 Detalles → Paso 3 ¿Para cuándo?" */
export function FormularioPedido({ datos, obraInicial }: { datos: DatosFormulario; obraInicial?: string }) {
  const router = useRouter();
  const aviso = useAviso();
  const unaObra = obraInicial && datos.obras.some((o) => o.id === obraInicial) ? obraInicial : datos.obras.length === 1 ? datos.obras[0].id : "";

  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  const [tipo, setTipo] = useState<TipoPedido>();
  // Detalles
  const [obraId, setObraId] = useState(unaObra);
  const [proveedorId, setProveedorId] = useState("");
  const [oc, setOc] = useState("");
  const [que, setQue] = useState("");
  const [pesoKg, setPesoKg] = useState("");
  const [desde, setDesde] = useState<Lugar>();
  const [herramientaId, setHerramientaId] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [volumen, setVolumen] = useState("");
  const [personas, setPersonas] = useState("");
  // Cuándo
  const hoy = diaISO();
  const [diaElegido, setDiaElegido] = useState<"hoy" | "manana" | "fecha">("hoy");
  const [fecha, setFecha] = useState(sumarDias(hoy, 2));
  const [franja, setFranja] = useState<"MANANA" | "TARDE" | "HORA_EXACTA">("MANANA");
  const [hora, setHora] = useState("09:00");
  const [prioridad, setPrioridad] = useState<"NORMAL" | "URGENTE">("NORMAL");

  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const [duplicado, setDuplicado] = useState<Duplicado | null>(null);
  const [guardadoSinSenal, setGuardadoSinSenal] = useState(false);

  const lugares = useMemo(
    () => [
      ...datos.ubicaciones.map((u) => ({ valor: clave({ tipo: u.tipo, id: u.id }), titulo: u.nombre })),
      ...datos.todasLasObras.map((o) => ({ valor: clave({ tipo: "OBRA", id: o.id }), titulo: `Obra ${o.nombre}` })),
    ],
    [datos],
  );
  const esTraslado = tipo === "TRASLADO_MAQUINARIA" || tipo === "TRASLADO_HERRAMIENTAS";
  const herramientas = useMemo(() => {
    if (!esTraslado) return [];
    const q = busqueda.trim().toLowerCase();
    return datos.herramientas
      .filter((h) => (tipo === "TRASLADO_MAQUINARIA" ? h.esMaquina : !h.esMaquina))
      .filter((h) => !q || h.nombre.toLowerCase().includes(q))
      .slice(0, 6);
  }, [datos.herramientas, busqueda, tipo, esTraslado]);

  function elegirTipo(t: TipoPedido) {
    setTipo(t);
    setError(undefined);
    setDesde(undefined);
    setHerramientaId("");
    setQue("");
    setPaso(2);
  }

  function elegirHerramienta(id: string) {
    const h = datos.herramientas.find((x) => x.id === id);
    setHerramientaId(id);
    if (!h) return;
    setQue(h.nombre);
    if (h.lugar) setDesde({ tipo: h.lugar.tipo, id: h.lugar.id });
  }

  /** Arma lo que va al servidor según el tipo. */
  function armar(): DatosPedido | string {
    if (!tipo) return "Elegí qué hay que hacer.";
    if (!obraId) return "Elegí la obra.";
    const base = { tipo: tipo as DatosPedido["tipo"], obraId, prioridad, franja, hora: franja === "HORA_EXACTA" ? hora : undefined, dia: diaElegido === "hoy" ? hoy : diaElegido === "manana" ? sumarDias(hoy, 1) : fecha };
    switch (tipo) {
      case "RETIRO_PROVEEDOR":
        if (!proveedorId) return "Elegí el proveedor.";
        if (que.trim().length < 3) return "Contá qué se retira.";
        if (!pesoKg) return "Elegí el peso aproximado.";
        return { ...base, origenTipo: "PROVEEDOR", origenId: proveedorId, ordenCompraLebane: oc, descripcion: que, pesoKg };
      case "TRASLADO_MAQUINARIA":
      case "TRASLADO_HERRAMIENTAS":
      case "LLEVAR_A_OBRA":
        if (que.trim().length < 3) return "Contá qué hay que llevar.";
        if (!desde) return "Elegí desde dónde.";
        return { ...base, origenTipo: desde.tipo, origenId: desde.id, descripcion: que, pesoKg: tipo === "LLEVAR_A_OBRA" ? pesoKg : undefined };
      case "RETIRO_ESCOMBROS": {
        const v = VOLUMEN_ESCOMBROS.find((x) => x.valor === volumen);
        if (!v) return "Elegí el volumen aproximado.";
        return { ...base, origenTipo: "OBRA", origenId: obraId, descripcion: `Retiro de escombros · ${v.titulo.toLowerCase()}`, pesoKg: v.kg };
      }
      case "TRASLADO_PERSONAS":
        if (!personas) return "¿Cuántas personas?";
        if (!desde) return "Elegí desde dónde.";
        return { ...base, origenTipo: desde.tipo, origenId: desde.id, cantidadPersonas: personas, descripcion: `Llevar ${personas} ${personas === "1" ? "persona" : "personas"}` };
      default:
        return "Elegí qué hay que hacer.";
    }
  }

  function pasoDosCompleto() {
    const r = armar();
    if (typeof r === "string") {
      setError(r);
      return;
    }
    setError(undefined);
    setPaso(3);
  }

  async function enviar(forzar = false) {
    const d = armar();
    if (typeof d === "string") return setError(d);
    setEnviando(true);
    setError(undefined);
    // Un clientId por intento: si no hay señal se guarda en el teléfono y el servidor no duplica al reenviar.
    const entrada = { ...d, forzar, clientId: crypto.randomUUID() };
    const obra = datos.obras.find((o) => o.id === entrada.obraId)?.nombre ?? "";
    const envio = await enviarOGuardar({ id: entrada.clientId, tipo: "pedido.crear", descripcion: `Pedido para Obra ${obra}: ${entrada.descripcion}`, datos: entrada }, () => crearPedido(entrada));
    setEnviando(false);
    if (envio.estado === "error") return setError(envio.error);
    if (envio.estado === "guardado") return setGuardadoSinSenal(true);
    if (envio.datos.estado === "duplicado") return setDuplicado(envio.datos.existente);

    const { id, choferes } = envio.datos;
    setDuplicado(null);
    aviso({
      mensaje: `Pedido enviado. Lo ${choferes.length === 1 ? "ve" : "ven"} ${choferes.length ? unirNombres(choferes) : "los choferes"}.`,
      deshacer: async () => {
        const x = await deshacerPedido(id);
        if (!x.ok) aviso({ mensaje: x.error, tono: "error" });
        router.refresh();
      },
    });
    router.push(`/mis-pedidos/${id}`);
  }

  const obraDestino = (
    <Campo etiqueta="Obra destino" htmlFor="obra">
      <Selector id="obra" value={obraId} onChange={(e) => setObraId(e.target.value)}>
        {!unaObra && <option value="">Elegí la obra</option>}
        {datos.obras.map((o) => (
          <option key={o.id} value={o.id}>Obra {o.nombre}</option>
        ))}
      </Selector>
    </Campo>
  );

  if (guardadoSinSenal) {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <CloudOff className="size-12" />
        <h2 className="text-2xl font-bold">Guardado en el teléfono</h2>
        <p className="max-w-sm text-suave">No hay señal. El pedido queda pendiente de envío y se manda solo cuando vuelva; arriba vas a ver el aviso hasta que salga.</p>
        <button onClick={() => router.push("/inicio")} className="min-h-[52px] w-full max-w-sm rounded-[var(--radius-caja)] bg-negro font-semibold text-white">Volver al inicio</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Progreso */}
      <div className="flex items-center gap-2">
        {paso > 1 && (
          <button type="button" onClick={() => setPaso((paso - 1) as 1 | 2)} aria-label="Volver" className="-ml-2 grid size-11 place-items-center rounded-md hover:bg-black/5">
            <ArrowLeft className="size-6" />
          </button>
        )}
        <div className="flex-1">
          <p className="text-sm font-semibold text-suave">Paso {paso} de 3</p>
          <div className="mt-1.5 flex gap-1">
            {[1, 2, 3].map((n) => (
              <span key={n} className={`h-1 flex-1 rounded-full ${n <= paso ? "bg-negro" : "bg-linea"}`} />
            ))}
          </div>
        </div>
      </div>

      {paso === 1 && (
        <section>
          <h2 className="mb-3 text-2xl font-bold">¿Qué hay que hacer?</h2>
          <div className="grid grid-cols-2 gap-2">
            {TIPOS_PARA_PEDIR.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => elegirTipo(t)}
                className={`flex min-h-[120px] flex-col items-start justify-between gap-2 rounded-[var(--radius-caja)] border-2 p-4 text-left ${tipo === t ? "border-negro bg-negro text-white" : "border-linea bg-papel hover:border-negro"}`}
              >
                <IconoTipo tipo={t} className="size-8" />
                <span>
                  <span className="block text-[17px] leading-tight font-bold">{TIPO[t].titulo}</span>
                  <span className={`mt-1 hidden text-sm sm:block ${tipo === t ? "text-white/70" : "text-suave"}`}>{TIPO[t].detalle}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {paso === 2 && tipo && (
        <section className="flex flex-col gap-4">
          <h2 className="flex items-center gap-2 text-2xl font-bold">
            <IconoTipo tipo={tipo} className="size-7" /> Detalles
          </h2>

          {tipo === "RETIRO_PROVEEDOR" && (
            <>
              <Campo etiqueta="Proveedor" htmlFor="prov">
                <Selector id="prov" value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
                  <option value="">Elegí el proveedor</option>
                  {datos.proveedores.map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </Selector>
              </Campo>
              <div className="grid grid-cols-[1fr_8rem] gap-3">
                <Campo etiqueta="¿Qué se retira?" htmlFor="que">
                  <Entrada id="que" value={que} onChange={(e) => setQue(e.target.value)} maxLength={240} placeholder="Ej.: hierro del 10, 40 barras" />
                </Campo>
                <Campo etiqueta="OC Lebane" htmlFor="oc">
                  <Entrada id="oc" value={oc} onChange={(e) => setOc(e.target.value)} maxLength={40} placeholder="Opcional" />
                </Campo>
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold">Peso aproximado</p>
                <Opciones nombre="Peso" columnas={4} valor={pesoKg} onElegir={setPesoKg} opciones={PESOS.map((p) => ({ valor: String(p.kg), titulo: p.titulo }))} />
              </div>
              {obraDestino}
            </>
          )}

          {esTraslado && (
            <>
              <div>
                <p className="mb-2 text-sm font-semibold">¿Qué {tipo === "TRASLADO_MAQUINARIA" ? "máquina" : "herramienta"}?</p>
                <div className="relative mb-2">
                  <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-suave" />
                  <Entrada type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar…" className="pl-11" aria-label="Buscar herramienta" />
                </div>
                <Opciones
                  nombre="Herramienta"
                  valor={herramientaId}
                  onElegir={elegirHerramienta}
                  opciones={herramientas.map((h) => ({ valor: h.id, titulo: h.nombre, detalle: h.lugar?.nombre }))}
                />
                <Campo etiqueta="O escribilo" htmlFor="que-libre">
                  <Entrada id="que-libre" value={que} onChange={(e) => { setQue(e.target.value); setHerramientaId(""); }} maxLength={240} />
                </Campo>
              </div>
              <Campo etiqueta="Desde" htmlFor="desde">
                <Selector id="desde" value={clave(desde)} onChange={(e) => setDesde(deClave(e.target.value))}>
                  <option value="">Elegí desde dónde</option>
                  {lugares.filter((l) => !l.valor.startsWith("BASE")).map((l) => (
                    <option key={l.valor} value={l.valor}>{l.titulo}</option>
                  ))}
                </Selector>
              </Campo>
              {obraDestino}
            </>
          )}

          {tipo === "LLEVAR_A_OBRA" && (
            <>
              <Campo etiqueta="¿Qué hay que llevar?" htmlFor="que">
                <Entrada id="que" value={que} onChange={(e) => setQue(e.target.value)} maxLength={240} placeholder="Ej.: 20 bolsas de cemento del depósito" />
              </Campo>
              <Campo etiqueta="Desde dónde" htmlFor="desde">
                <Selector id="desde" value={clave(desde)} onChange={(e) => setDesde(deClave(e.target.value))}>
                  <option value="">Elegí desde dónde</option>
                  {lugares.map((l) => (
                    <option key={l.valor} value={l.valor}>{l.titulo}</option>
                  ))}
                </Selector>
              </Campo>
              <div>
                <p className="mb-2 text-sm font-semibold">Peso aproximado (si sabés)</p>
                <Opciones nombre="Peso" columnas={4} valor={pesoKg} onElegir={(v) => setPesoKg(v === pesoKg ? "" : v)} opciones={PESOS.map((p) => ({ valor: String(p.kg), titulo: p.titulo }))} />
              </div>
              {obraDestino}
            </>
          )}

          {tipo === "RETIRO_ESCOMBROS" && (
            <>
              {obraDestino}
              <div>
                <p className="mb-2 text-sm font-semibold">Volumen aproximado</p>
                <Opciones nombre="Volumen" columnas={2} valor={volumen} onElegir={setVolumen} opciones={VOLUMEN_ESCOMBROS.map((v) => ({ valor: v.valor, titulo: v.titulo }))} />
              </div>
            </>
          )}

          {tipo === "TRASLADO_PERSONAS" && (
            <>
              <div>
                <p className="mb-2 text-sm font-semibold">¿Cuántas personas?</p>
                <Opciones nombre="Personas" columnas={4} valor={personas} onElegir={setPersonas} opciones={["1", "2", "3", "4", "5", "6", "8", "10"].map((n) => ({ valor: n, titulo: n }))} />
              </div>
              <Campo etiqueta="Desde" htmlFor="desde">
                <Selector id="desde" value={clave(desde)} onChange={(e) => setDesde(deClave(e.target.value))}>
                  <option value="">Elegí desde dónde</option>
                  {lugares.map((l) => (
                    <option key={l.valor} value={l.valor}>{l.titulo}</option>
                  ))}
                </Selector>
              </Campo>
              {obraDestino}
            </>
          )}

          <MensajeError>{error}</MensajeError>
          <Boton ancho tamano="grande" onClick={pasoDosCompleto}>Siguiente</Boton>
        </section>
      )}

      {paso === 3 && (
        <section className="flex flex-col gap-5">
          <h2 className="text-2xl font-bold">¿Para cuándo?</h2>
          <div className="flex flex-col gap-2">
            <Opciones
              nombre="Día"
              columnas={3}
              valor={diaElegido}
              onElegir={(v) => setDiaElegido(v as typeof diaElegido)}
              opciones={[
                { valor: "hoy", titulo: "Hoy" },
                { valor: "manana", titulo: "Mañana" },
                { valor: "fecha", titulo: "Elegir fecha" },
              ]}
            />
            {diaElegido === "fecha" && <Fecha aria-label="Fecha" value={fecha} min={hoy} onChange={(e) => setFecha(e.target.value)} />}
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold">Hora aproximada</p>
            <Opciones
              nombre="Hora"
              columnas={3}
              valor={franja}
              onElegir={(v) => setFranja(v as typeof franja)}
              opciones={[
                { valor: "MANANA", titulo: "Mañana" },
                { valor: "TARDE", titulo: "Tarde" },
                { valor: "HORA_EXACTA", titulo: "Hora exacta" },
              ]}
            />
            {franja === "HORA_EXACTA" && <Entrada type="time" aria-label="Hora exacta" value={hora} onChange={(e) => setHora(e.target.value)} />}
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold">Prioridad</p>
            <Opciones
              nombre="Prioridad"
              columnas={2}
              valor={prioridad}
              onElegir={(v) => setPrioridad(v as typeof prioridad)}
              opciones={[
                { valor: "NORMAL", titulo: "Normal" },
                { valor: "URGENTE", titulo: "Urgente" },
              ]}
            />
            <p className="text-sm text-suave">Urgente solo si la obra se para sin esto.</p>
          </div>
          <MensajeError>{error}</MensajeError>
          <Boton ancho tamano="grande" cargando={enviando} onClick={() => enviar(false)} icono={<Send className="size-5" />}>
            Pedir el viaje
          </Boton>
        </section>
      )}

      {/* Aviso de duplicado: el punto que más valor tiene de toda la app. */}
      <Hoja abierta={!!duplicado} onCerrar={() => setDuplicado(null)} titulo="¿Es el mismo pedido?">
        {duplicado && (
          <div className="flex flex-col gap-4">
            <div className="flex gap-3 rounded-[var(--radius-caja)] border-2 border-aviso bg-aviso-fondo p-4">
              <Copy className="mt-0.5 size-6 shrink-0 text-aviso" />
              <div>
                <p className="text-lg font-bold">
                  {duplicado.quien} ya pidió esto {duplicado.cuando}:
                </p>
                <p className="mt-1">{duplicado.resumen}</p>
                <p className="mt-1 text-sm text-suave">Pedido {duplicado.numero}</p>
              </div>
            </div>
            <p className="font-semibold">¿Es lo mismo?</p>
            <Boton ancho tamano="grande" onClick={() => router.push(`/mis-pedidos/${duplicado.id}`)}>
              Sí, es lo mismo
            </Boton>
            <Boton ancho variante="secundario" cargando={enviando} onClick={() => enviar(true)}>
              No, es otro pedido
            </Boton>
          </div>
        )}
      </Hoja>
    </div>
  );
}

function unirNombres(n: string[]) {
  return n.length <= 1 ? n.join("") : `${n.slice(0, -1).join(", ")} y ${n.at(-1)}`;
}
