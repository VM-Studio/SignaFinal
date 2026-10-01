"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArchiveX, ArrowRightLeft, CalendarPlus, PackageCheck, SearchX, Truck, Undo2, Wrench, WrenchIcon } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Hoja } from "@/components/ui/hoja";
import { Opciones } from "@/components/ui/opciones";
import { AreaTexto, Campo, Entrada, Fecha, MensajeError, Selector } from "@/components/ui/campos";
import { useAviso } from "@/components/ui/avisos";
import {
  darDeBaja, devolver, entregar, enviarAReparacion, marcarExtraviada, pedirHerramienta, reaparecio, registrarMantenimiento, transferir, volvioDeReparacion,
} from "@/lib/herramientas/acciones";
import { MOTIVOS_BAJA, MOTIVOS_EXTRAVIO, type Accion } from "@/lib/herramientas/presentacion";
import { diaISO, sumarDias } from "@/lib/formato";
import type { Resultado } from "@/lib/resultado";

export type DatosAcciones = {
  herramienta: {
    id: string; nombre: string; estado: string; tipoControl: "UNITARIA" | "CANTIDAD"; esMaquina: boolean; obraId: string | null;
    responsableObraId: string | null; stockDeposito: number; existencias: { obraId: string; obra: string; cantidad: number }[]; mantenimientoCadaDias: number | null;
  };
  obras: { id: string; nombre: string; responsableId: string }[];
  misObras: { id: string; nombre: string }[];
  personas: { id: string; nombre: string }[];
  puede: { mover: boolean; devolver: boolean; editar: boolean; mantenimiento: boolean; pedir: boolean };
  yoId: string;
  pedidoActivo: string | null; // "Ya la pidió Daniela para Obra Darwin"
};

const CONDICIONES = [{ valor: "BUENA", titulo: "Buena" }, { valor: "REGULAR", titulo: "Regular" }, { valor: "MALA", titulo: "Mala" }];

function useResultado() {
  const router = useRouter();
  const aviso = useAviso();
  return async <T,>(r: Resultado<T>, mensaje: string | ((d: T) => string), setError: (e?: string) => void, cerrar: () => void) => {
    if (!r.ok) {
      setError(r.error);
      return false;
    }
    cerrar();
    aviso({ mensaje: typeof mensaje === "string" ? mensaje : mensaje(r.datos) });
    router.refresh();
    return true;
  };
}

/** Botones según estado y permisos. ?accion=entregar abre la hoja ya elegida (lo usa el escáner). */
export function AccionesHerramienta({ d, accionInicial }: { d: DatosAcciones; accionInicial?: Accion | null }) {
  const [abierta, setAbierta] = useState<Accion | "mantenimiento" | null>(null);
  useEffect(() => {
    if (accionInicial) setAbierta(accionInicial);
  }, [accionInicial]);
  const h = d.herramienta;
  const cantidad = h.tipoControl === "CANTIDAD";
  const enObra = h.estado === "EN_OBRA";
  const responsableDeLaObra = d.misObras.some((o) => o.id === h.obraId) || (cantidad && h.existencias.some((e) => d.misObras.some((o) => o.id === e.obraId)));

  const botones: { id: Accion | "mantenimiento"; texto: string; icono: ReactNode; mostrar: boolean; variante?: "primario" | "secundario" | "peligro" | "fantasma" }[] = [
    { id: "pedir", texto: `La necesito en ${d.misObras.length === 1 ? `Obra ${d.misObras[0].nombre}` : "mi obra"}`, icono: <CalendarPlus className="size-5" />, mostrar: d.puede.pedir && d.misObras.length > 0 && (h.estado === "DISPONIBLE" || enObra || (cantidad && h.stockDeposito > 0)) && !d.misObras.every((o) => o.id === h.obraId) },
    { id: "entregar", texto: "Entregar a obra", icono: <Truck className="size-5" />, mostrar: d.puede.mover && (cantidad ? h.stockDeposito > 0 : h.estado === "DISPONIBLE") },
    { id: "devolver", texto: "Registrar devolución", icono: <PackageCheck className="size-5" />, mostrar: d.puede.devolver && (cantidad ? h.existencias.length > 0 : enObra) && (d.puede.mover || responsableDeLaObra || d.misObras.length > 1) },
    { id: "transferir", texto: "Transferir a otra obra", icono: <ArrowRightLeft className="size-5" />, mostrar: d.puede.mover && (cantidad ? h.existencias.length > 0 : enObra), variante: "secundario" },
    { id: "reparar", texto: "Enviar a reparación", icono: <Wrench className="size-5" />, mostrar: d.puede.mantenimiento && !cantidad && (h.estado === "DISPONIBLE" || enObra), variante: "secundario" },
    { id: "volvio", texto: "Volvió de reparación", icono: <Undo2 className="size-5" />, mostrar: d.puede.mantenimiento && h.estado === "EN_REPARACION" },
    { id: "mantenimiento", texto: "Registrar mantenimiento", icono: <WrenchIcon className="size-5" />, mostrar: d.puede.mantenimiento && !cantidad && h.estado !== "BAJA", variante: "fantasma" },
    { id: "extraviada", texto: h.estado === "EXTRAVIADA" ? "Apareció" : "Marcar extraviada", icono: <SearchX className="size-5" />, mostrar: d.puede.mover && !cantidad && (h.estado === "DISPONIBLE" || enObra || h.estado === "EXTRAVIADA"), variante: "fantasma" },
    { id: "baja", texto: "Dar de baja", icono: <ArchiveX className="size-5" />, mostrar: d.puede.editar && h.estado !== "BAJA" && h.estado !== "EN_OBRA", variante: "peligro" },
  ];
  const visibles = botones.filter((b) => b.mostrar);
  if (!visibles.length) return null;
  const cerrar = () => setAbierta(null);

  return (
    <div className="flex flex-col gap-2">
      {d.pedidoActivo && <p className="rounded-[var(--radius-caja)] bg-aviso-fondo px-3 py-2 text-sm font-medium text-aviso">{d.pedidoActivo}</p>}
      {visibles.map((b, i) => (
        <Boton key={b.id} ancho variante={b.variante ?? (i === 0 ? "primario" : "secundario")} tamano={i === 0 ? "grande" : "normal"} icono={b.icono} onClick={() => setAbierta(b.id)}>
          {b.texto}
        </Boton>
      ))}
      <Hoja abierta={abierta === "pedir"} onCerrar={cerrar} titulo={`Pedir ${h.nombre}`}><Pedir d={d} cerrar={cerrar} /></Hoja>
      <Hoja abierta={abierta === "entregar"} onCerrar={cerrar} titulo={`Entregar ${h.nombre}`}><Entregar d={d} cerrar={cerrar} /></Hoja>
      <Hoja abierta={abierta === "devolver"} onCerrar={cerrar} titulo={`Devolución de ${h.nombre}`}><Devolver d={d} cerrar={cerrar} /></Hoja>
      <Hoja abierta={abierta === "transferir"} onCerrar={cerrar} titulo={`Transferir ${h.nombre}`}><Transferir d={d} cerrar={cerrar} /></Hoja>
      <Hoja abierta={abierta === "reparar"} onCerrar={cerrar} titulo="Enviar a reparación"><ConMotivo cerrar={cerrar} etiqueta="¿Qué tiene? ¿A qué taller va?" boton="Enviar a reparación" opciones={[]} accion={(m) => enviarAReparacion(h.id, m)} mensaje={`${h.nombre} quedó en reparación.`} opcional /></Hoja>
      <Hoja abierta={abierta === "volvio"} onCerrar={cerrar} titulo="Volvió de reparación"><Volvio d={d} cerrar={cerrar} /></Hoja>
      <Hoja abierta={abierta === "mantenimiento"} onCerrar={cerrar} titulo="Registrar mantenimiento"><Mantenimiento d={d} cerrar={cerrar} /></Hoja>
      <Hoja abierta={abierta === "extraviada"} onCerrar={cerrar} titulo={h.estado === "EXTRAVIADA" ? "Apareció" : "Marcar extraviada"}>
        {h.estado === "EXTRAVIADA" ? (
          <ConMotivo cerrar={cerrar} etiqueta="Vuelve al depósito" boton="Apareció, vuelve al depósito" opciones={[]} accion={() => reaparecio(h.id)} mensaje={`${h.nombre} volvió al depósito.`} opcional sinCampo />
        ) : (
          <ConMotivo cerrar={cerrar} etiqueta="¿Qué pasó?" boton="Marcar extraviada" opciones={MOTIVOS_EXTRAVIO} accion={(m) => marcarExtraviada(h.id, m)} mensaje={`${h.nombre} quedó marcada como extraviada.`} peligro />
        )}
      </Hoja>
      <Hoja abierta={abierta === "baja"} onCerrar={cerrar} titulo={`Dar de baja ${h.nombre}`}><ConMotivo cerrar={cerrar} etiqueta="¿Por qué?" boton="Dar de baja" opciones={MOTIVOS_BAJA} accion={(m) => darDeBaja(h.id, m)} mensaje={`${h.nombre} quedó dada de baja.`} peligro /></Hoja>
    </div>
  );
}

// ─────────────────────────── Cada hoja ───────────────────────────

function Fechas({ valor, onCambio, etiqueta }: { valor: string; onCambio: (v: string) => void; etiqueta: string }) {
  const hoy = diaISO();
  const opciones = [{ valor: sumarDias(hoy, 7), titulo: "1 semana" }, { valor: sumarDias(hoy, 14), titulo: "2 semanas" }, { valor: sumarDias(hoy, 30), titulo: "1 mes" }];
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold">{etiqueta}</p>
      <Opciones nombre={etiqueta} columnas={3} valor={valor} onElegir={onCambio} opciones={opciones} />
      <Fecha aria-label="Otra fecha" value={valor} min={hoy} onChange={(e) => onCambio(e.target.value)} />
    </div>
  );
}

function Entregar({ d, cerrar }: { d: DatosAcciones; cerrar: () => void }) {
  const [obraId, setObraId] = useState("");
  const [recibe, setRecibe] = useState("");
  const [vuelve, setVuelve] = useState(sumarDias(diaISO(), 14));
  const [cant, setCant] = useState("1");
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const fin = useResultado();
  const cantidad = d.herramienta.tipoControl === "CANTIDAD";
  return (
    <div className="flex flex-col gap-4">
      <Campo etiqueta="¿A qué obra?" htmlFor="ent-obra">
        <Selector id="ent-obra" value={obraId} onChange={(e) => { setObraId(e.target.value); setRecibe(d.obras.find((o) => o.id === e.target.value)?.responsableId ?? ""); }}>
          <option value="">Elegí la obra</option>
          {d.obras.map((o) => <option key={o.id} value={o.id}>Obra {o.nombre}</option>)}
        </Selector>
      </Campo>
      <Campo etiqueta="¿Quién la recibe?" htmlFor="ent-recibe">
        <Selector id="ent-recibe" value={recibe} onChange={(e) => setRecibe(e.target.value)}>
          <option value="">Elegí la persona</option>
          {d.personas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </Selector>
      </Campo>
      {cantidad ? (
        <Campo etiqueta={`Cantidad (hay ${d.herramienta.stockDeposito} en el depósito)`} htmlFor="ent-cant">
          <Entrada id="ent-cant" inputMode="numeric" value={cant} onChange={(e) => setCant(e.target.value.replace(/\D/g, ""))} />
        </Campo>
      ) : (
        <Fechas etiqueta="¿Cuándo vuelve?" valor={vuelve} onCambio={setVuelve} />
      )}
      <MensajeError>{error}</MensajeError>
      <Boton ancho tamano="grande" disabled={!obraId || !recibe} cargando={enviando} onClick={async () => {
        setEnviando(true);
        const r = await entregar({ herramientaId: d.herramienta.id, obraId, recibidoPorId: recibe, devolucionPrevista: cantidad ? undefined : vuelve, cantidad: cant });
        setEnviando(false);
        await fin(r, (x) => `Entregada en Obra ${d.obras.find((o) => o.id === obraId)?.nombre}${x.viaje ? ` · viaja con ${x.viaje}` : ""}.`, setError, cerrar);
      }}>Entregar</Boton>
    </div>
  );
}

function Devolver({ d, cerrar }: { d: DatosAcciones; cerrar: () => void }) {
  const cantidad = d.herramienta.tipoControl === "CANTIDAD";
  const origenes = cantidad ? d.herramienta.existencias.filter((e) => d.puede.mover || d.misObras.some((o) => o.id === e.obraId)) : [];
  const [desde, setDesde] = useState(origenes.length === 1 ? origenes[0].obraId : "");
  const [cant, setCant] = useState("1");
  const [condicion, setCondicion] = useState("BUENA");
  const [reparar, setReparar] = useState(true);
  const [obs, setObs] = useState("");
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const fin = useResultado();
  const maximo = origenes.find((e) => e.obraId === desde)?.cantidad;
  return (
    <div className="flex flex-col gap-4">
      {cantidad && (
        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <Campo etiqueta="¿De qué obra vuelve?" htmlFor="dev-desde">
            <Selector id="dev-desde" value={desde} onChange={(e) => setDesde(e.target.value)}>
              <option value="">Elegí la obra</option>
              {origenes.map((o) => <option key={o.obraId} value={o.obraId}>Obra {o.obra} ({o.cantidad})</option>)}
            </Selector>
          </Campo>
          <Campo etiqueta={maximo ? `Cantidad (≤ ${maximo})` : "Cantidad"} htmlFor="dev-cant"><Entrada id="dev-cant" inputMode="numeric" value={cant} onChange={(e) => setCant(e.target.value.replace(/\D/g, ""))} /></Campo>
        </div>
      )}
      <div>
        <p className="mb-2 text-sm font-semibold">¿En qué condición vuelve?</p>
        <Opciones nombre="Condición" columnas={3} valor={condicion} onElegir={setCondicion} opciones={CONDICIONES} />
      </div>
      {condicion === "MALA" && !cantidad && (
        <label className="flex min-h-[56px] items-center justify-between gap-3 rounded-[var(--radius-caja)] border-2 border-critico bg-critico-fondo px-4 text-critico">
          <span className="font-semibold">Mandarla directo a reparación</span>
          <input type="checkbox" checked={reparar} onChange={(e) => setReparar(e.target.checked)} className="size-6 accent-critico" />
        </label>
      )}
      <Campo etiqueta="Observaciones (opcional)" htmlFor="dev-obs"><Entrada id="dev-obs" value={obs} onChange={(e) => setObs(e.target.value)} maxLength={300} /></Campo>
      <MensajeError>{error}</MensajeError>
      <Boton ancho tamano="grande" disabled={cantidad && !desde} cargando={enviando} onClick={async () => {
        setEnviando(true);
        const r = await devolver({ herramientaId: d.herramienta.id, condicion: condicion as "BUENA", desdeObraId: desde, cantidad: cant, observaciones: obs, aReparacion: reparar });
        setEnviando(false);
        await fin(r, (x) => (x.enReparacion ? "Devuelta y enviada a reparación." : "Devolución registrada: está en el depósito."), setError, cerrar);
      }}>Registrar devolución</Boton>
    </div>
  );
}

function Transferir({ d, cerrar }: { d: DatosAcciones; cerrar: () => void }) {
  const cantidad = d.herramienta.tipoControl === "CANTIDAD";
  const [desde, setDesde] = useState(cantidad ? "" : d.herramienta.obraId ?? "");
  const [hacia, setHacia] = useState("");
  const [recibe, setRecibe] = useState("");
  const [cant, setCant] = useState("1");
  const [vuelve, setVuelve] = useState(sumarDias(diaISO(), 14));
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const fin = useResultado();
  return (
    <div className="flex flex-col gap-4">
      {cantidad && (
        <Campo etiqueta="Desde" htmlFor="tr-desde">
          <Selector id="tr-desde" value={desde} onChange={(e) => setDesde(e.target.value)}>
            <option value="">Elegí la obra</option>
            {d.herramienta.existencias.map((o) => <option key={o.obraId} value={o.obraId}>Obra {o.obra} ({o.cantidad})</option>)}
          </Selector>
        </Campo>
      )}
      <Campo etiqueta="¿A qué obra?" htmlFor="tr-hacia">
        <Selector id="tr-hacia" value={hacia} onChange={(e) => { setHacia(e.target.value); setRecibe(d.obras.find((o) => o.id === e.target.value)?.responsableId ?? ""); }}>
          <option value="">Elegí la obra</option>
          {d.obras.filter((o) => o.id !== desde).map((o) => <option key={o.id} value={o.id}>Obra {o.nombre}</option>)}
        </Selector>
      </Campo>
      <Campo etiqueta="¿Quién la recibe?" htmlFor="tr-recibe">
        <Selector id="tr-recibe" value={recibe} onChange={(e) => setRecibe(e.target.value)}>
          <option value="">Elegí la persona</option>
          {d.personas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </Selector>
      </Campo>
      {cantidad ? (
        <Campo etiqueta="Cantidad" htmlFor="tr-cant"><Entrada id="tr-cant" inputMode="numeric" value={cant} onChange={(e) => setCant(e.target.value.replace(/\D/g, ""))} /></Campo>
      ) : (
        <Fechas etiqueta="¿Cuándo vuelve?" valor={vuelve} onCambio={setVuelve} />
      )}
      <MensajeError>{error}</MensajeError>
      <Boton ancho tamano="grande" disabled={!hacia || !recibe || (cantidad && !desde)} cargando={enviando} onClick={async () => {
        setEnviando(true);
        const r = await transferir({ herramientaId: d.herramienta.id, haciaObraId: hacia, recibidoPorId: recibe, desdeObraId: desde, cantidad: cant, devolucionPrevista: cantidad ? undefined : vuelve });
        setEnviando(false);
        await fin(r, `Transferida a Obra ${d.obras.find((o) => o.id === hacia)?.nombre}.`, setError, cerrar);
      }}>Transferir</Boton>
    </div>
  );
}

function Volvio({ d, cerrar }: { d: DatosAcciones; cerrar: () => void }) {
  const [condicion, setCondicion] = useState("BUENA");
  const [descripcion, setDescripcion] = useState("");
  const [costo, setCosto] = useState("");
  const [taller, setTaller] = useState("");
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const fin = useResultado();
  return (
    <div className="flex flex-col gap-4">
      <div><p className="mb-2 text-sm font-semibold">¿Cómo vuelve?</p><Opciones nombre="Condición" columnas={3} valor={condicion} onElegir={setCondicion} opciones={CONDICIONES} /></div>
      <Campo etiqueta="¿Qué le hicieron?" htmlFor="vu-desc"><Entrada id="vu-desc" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} maxLength={300} /></Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Costo ($)" htmlFor="vu-costo"><Entrada id="vu-costo" inputMode="decimal" value={costo} onChange={(e) => setCosto(e.target.value)} placeholder="0" /></Campo>
        <Campo etiqueta="Taller" htmlFor="vu-taller"><Entrada id="vu-taller" value={taller} onChange={(e) => setTaller(e.target.value)} maxLength={80} /></Campo>
      </div>
      <MensajeError>{error}</MensajeError>
      <Boton ancho tamano="grande" cargando={enviando} onClick={async () => {
        setEnviando(true);
        const r = await volvioDeReparacion({ herramientaId: d.herramienta.id, condicion: condicion as "BUENA", descripcion, costo, taller });
        setEnviando(false);
        await fin(r, `${d.herramienta.nombre} volvió al depósito.`, setError, cerrar);
      }}>Volvió al depósito</Boton>
    </div>
  );
}

function Mantenimiento({ d, cerrar }: { d: DatosAcciones; cerrar: () => void }) {
  const [fecha, setFecha] = useState(diaISO());
  const [descripcion, setDescripcion] = useState("");
  const [costo, setCosto] = useState("");
  const [cada, setCada] = useState(d.herramienta.mantenimientoCadaDias ? String(d.herramienta.mantenimientoCadaDias) : "");
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const fin = useResultado();
  return (
    <div className="flex flex-col gap-4">
      <Campo etiqueta="¿Qué se hizo?" htmlFor="mh-desc"><Entrada id="mh-desc" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} maxLength={300} placeholder="Ej.: cambio de aceite y correa" /></Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Fecha" htmlFor="mh-fecha"><Fecha id="mh-fecha" value={fecha} max={diaISO()} onChange={(e) => setFecha(e.target.value)} /></Campo>
        <Campo etiqueta="Costo ($)" htmlFor="mh-costo"><Entrada id="mh-costo" inputMode="decimal" value={costo} onChange={(e) => setCosto(e.target.value)} placeholder="0" /></Campo>
      </div>
      <Campo etiqueta="Repetir cada (días)" htmlFor="mh-cada" ayuda={cada ? `Próximo: ${sumarDias(fecha, Number(cada) || 0)}` : "Opcional: calcula la próxima fecha."}>
        <Entrada id="mh-cada" inputMode="numeric" value={cada} onChange={(e) => setCada(e.target.value.replace(/\D/g, ""))} placeholder="90" />
      </Campo>
      <MensajeError>{error}</MensajeError>
      <Boton ancho tamano="grande" disabled={descripcion.trim().length < 3} cargando={enviando} onClick={async () => {
        setEnviando(true);
        const r = await registrarMantenimiento({ herramientaId: d.herramienta.id, fecha, descripcion, costo, cadaDias: cada });
        setEnviando(false);
        await fin(r, (x) => `Mantenimiento registrado${x.proximo ? `. Próximo: ${x.proximo.split("-").reverse().join("/")}` : ""}.`, setError, cerrar);
      }}>Registrar</Boton>
    </div>
  );
}

/** "La necesito en [obra] para [fecha]": crea el pedido de viaje. */
function Pedir({ d, cerrar }: { d: DatosAcciones; cerrar: () => void }) {
  const destinos = d.misObras.filter((o) => o.id !== d.herramienta.obraId);
  const [obraId, setObraId] = useState(destinos.length === 1 ? destinos[0].id : "");
  const hoy = diaISO();
  const [dia, setDia] = useState(sumarDias(hoy, 1));
  const [franja, setFranja] = useState("MANANA");
  const [cant, setCant] = useState("1");
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const fin = useResultado();
  const cantidad = d.herramienta.tipoControl === "CANTIDAD";
  return (
    <div className="flex flex-col gap-4">
      {destinos.length > 1 && (
        <Campo etiqueta="¿Para qué obra?" htmlFor="pd-obra">
          <Selector id="pd-obra" value={obraId} onChange={(e) => setObraId(e.target.value)}>
            <option value="">Elegí la obra</option>
            {destinos.map((o) => <option key={o.id} value={o.id}>Obra {o.nombre}</option>)}
          </Selector>
        </Campo>
      )}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold">¿Para cuándo?</p>
        <Opciones nombre="Día" columnas={3} valor={dia} onElegir={setDia} opciones={[{ valor: hoy, titulo: "Hoy" }, { valor: sumarDias(hoy, 1), titulo: "Mañana" }, { valor: sumarDias(hoy, 2), titulo: "Pasado" }]} />
        <Fecha aria-label="Otra fecha" value={dia} min={hoy} onChange={(e) => setDia(e.target.value)} />
        <Opciones nombre="Franja" columnas={2} valor={franja} onElegir={setFranja} opciones={[{ valor: "MANANA", titulo: "A la mañana" }, { valor: "TARDE", titulo: "A la tarde" }]} />
      </div>
      {cantidad && <Campo etiqueta={`Cantidad (hay ${d.herramienta.stockDeposito})`} htmlFor="pd-cant"><Entrada id="pd-cant" inputMode="numeric" value={cant} onChange={(e) => setCant(e.target.value.replace(/\D/g, ""))} /></Campo>}
      <MensajeError>{error}</MensajeError>
      <Boton ancho tamano="grande" disabled={!obraId} cargando={enviando} onClick={async () => {
        setEnviando(true);
        const r = await pedirHerramienta({ herramientaId: d.herramienta.id, obraId, dia, franja: franja as "MANANA", cantidad: cant });
        setEnviando(false);
        await fin(r, (x) => `Pedido ${x.numero} en la cola. Lo ven ${x.choferes.join(" y ") || "los choferes"}${x.avisado ? `; también lo ve ${x.avisado}` : ""}.`, setError, cerrar);
      }}>La necesito en {destinos.find((o) => o.id === obraId) ? `Obra ${destinos.find((o) => o.id === obraId)!.nombre}` : "la obra"}</Boton>
    </div>
  );
}

function ConMotivo({ cerrar, etiqueta, boton, opciones, accion, mensaje, opcional, peligro, sinCampo }: {
  cerrar: () => void; etiqueta: string; boton: string; opciones: string[]; accion: (m: string) => Promise<Resultado>; mensaje: string; opcional?: boolean; peligro?: boolean; sinCampo?: boolean;
}) {
  const [elegido, setElegido] = useState("");
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const fin = useResultado();
  const motivo = elegido === "otro" || !opciones.length ? texto : elegido;
  return (
    <div className="flex flex-col gap-4">
      {!sinCampo && (
        <>
          <p className="font-semibold">{etiqueta}</p>
          {opciones.length > 0 && <Opciones nombre={etiqueta} valor={elegido} onElegir={setElegido} opciones={[...opciones.map((o) => ({ valor: o, titulo: o })), { valor: "otro", titulo: "Otro motivo" }]} />}
          {(elegido === "otro" || !opciones.length) && <AreaTexto aria-label={etiqueta} rows={2} value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={300} />}
        </>
      )}
      <MensajeError>{error}</MensajeError>
      <Boton ancho tamano="grande" variante={peligro ? "peligro" : "primario"} disabled={!opcional && motivo.trim().length < 3} cargando={enviando} onClick={async () => {
        setEnviando(true);
        const r = await accion(motivo);
        setEnviando(false);
        await fin(r, mensaje, setError, cerrar);
      }}>{boton}</Boton>
    </div>
  );
}
