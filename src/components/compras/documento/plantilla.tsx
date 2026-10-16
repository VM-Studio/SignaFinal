"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type HTMLAttributes, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Ban, Check, ChevronDown, CornerUpLeft, FileDown, History, MoreHorizontal, PackageCheck, PackageOpen, PenLine, Send, Stamp, Truck } from "lucide-react";
import { CELDAS, faltan as faltanPara, type Celda } from "@/lib/compras/permisosCeldas";
import type { DocumentoPlantilla } from "@/lib/compras/documento-consultas";
import type { ProveedorConSucursales } from "@/lib/proveedores/acciones";
import type { Resultado } from "@/lib/resultado";
import {
  adjuntarADocumento, anularDocumento, aprobarDocumento, autorizarPago, deshacerAprobacion, devolverASolicitante, enviarAAutorizacion, enviarACompras,
  guardarCelda, guardarNotasInternas, historialCeldas, latido, leerDocumentoVivo, marcarEncargada, marcarPresupuestoSolicitado, pedirAutorizacionPago, rechazarDocumento,
} from "@/lib/compras/documento-acciones";
import { ESTADO_DOC, ESTADO_RETIRO, MODO_ENTREGA, PASOS_DOC, ordenPaso } from "@/lib/compras/documento";
import { useEventosCambio } from "@/components/layout/tiempo-real";
import { useAviso } from "@/components/ui/avisos";
import { Insignia } from "@/components/ui/basicos";
import { Boton, BotonLink, claseBoton } from "@/components/ui/boton";
import { Hoja } from "@/components/ui/hoja";
import { AreaTexto } from "@/components/ui/campos";
import { ListaAdjuntos } from "@/components/adjuntos/lista";
import { SubirAdjuntos } from "@/components/adjuntos/subir";
import { VolverA } from "@/components/ui/volver";
import { HojaOC } from "./hoja";
import { EditorCelda } from "./editores";
import { FormHabilitar } from "./habilitar";

/**
 * LA PLANTILLA COMO DOCUMENTO COMPARTIDO (/compras/oc/[id]). La hoja A4 calcada del PDF ocupa la página
 * (centrada, el sobrante a los lados en gris, sin paneles laterales); cada celda se edita en línea y se
 * guarda sola (800 ms) o con Ctrl+S, con número de versión: si otro la cambió, se muestra su valor ("Alejandra
 * cambió esto hace 10 s") sin pisarlo. Lo que cambian los demás llega por el tiempo real y destella 1 s.
 * Arriba: "← Volver", número y estado, las acciones; quién más la está viendo y "Guardado 17:59".
 */
type Valores = Record<string, string>;
type AtributosCelda = HTMLAttributes<HTMLDivElement> & Record<`data-${string}`, boolean | undefined>;
type Volver = { clave: string; href: string; etiqueta: string };

const horaCorta = (d: Date) => new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);

export function PlantillaDocumento({ d, volver }: { d: DocumentoPlantilla; volver: Volver }) {
  const router = useRouter();
  const aviso = useAviso();
  const [valores, setValores] = useState<Valores>(d.valores);
  const [textos, setTextos] = useState<Valores>(d.textos);
  const [versiones, setVersiones] = useState<Record<string, number>>(d.versiones);
  const [guardadoEn, setGuardadoEn] = useState<Date | null>(null);
  const [guardando, setGuardando] = useState(0);
  const [conflictos, setConflictos] = useState<Record<string, string>>({});
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [destellos, setDestellos] = useState<Set<string>>(new Set());
  const [modificar, setModificar] = useState(false);
  const [viendo, setViendo] = useState<{ id: string; nombre: string }[]>([]);
  const [proveedores, setProveedores] = useState<ProveedorConSucursales[]>(d.listas.proveedores);

  // Lo que se está escribiendo no lo pisa el tiempo real.
  const v = useRef(valores);
  const ver = useRef(versiones);
  const timers = useRef<Record<string, number>>({});
  const enVuelo = useRef<Record<string, boolean>>({});
  const otraVez = useRef<Record<string, boolean>>({});
  const foco = useRef<string | null>(null);
  useEffect(() => { v.current = valores; }, [valores]);
  useEffect(() => { ver.current = versiones; }, [versiones]);

  // El servidor manda (después de una acción o de router.refresh): se toman sus valores donde no hay nada pendiente.
  useEffect(() => {
    setValores((prev) => {
      const n = { ...prev };
      for (const [c, x] of Object.entries(d.valores)) if (!timers.current[c] && !enVuelo.current[c] && foco.current !== c) n[c] = x;
      return n;
    });
    setTextos(d.textos);
    setVersiones((prev) => ({ ...prev, ...d.versiones }));
  }, [d.valores, d.textos, d.versiones]);

  const editable = useCallback((c: Celda) => d.editables.includes(c) || (modificar && d.modificables.includes(c)), [d.editables, d.modificables, modificar]);

  const destellar = (cs: string[]) => {
    if (!cs.length) return;
    setDestellos(new Set(cs));
    window.setTimeout(() => setDestellos(new Set()), 1000);
  };

  async function guardar(celda: Celda) {
    delete timers.current[celda];
    if (enVuelo.current[celda]) { otraVez.current[celda] = true; return; }
    const valor = v.current[celda] ?? "";
    enVuelo.current[celda] = true;
    setGuardando((n) => n + 1);
    const r = await guardarCelda(d.id, celda, valor, ver.current[celda] ?? 0, { modificar });
    enVuelo.current[celda] = false;
    setGuardando((n) => n - 1);
    if (!r.ok) {
      setErrores((e) => ({ ...e, [celda]: r.error }));
      aviso({ mensaje: r.error, tono: "error" });
      return;
    }
    setErrores((e) => { const n = { ...e }; delete n[celda]; return n; });
    const x = r.datos;
    setVersiones((p) => ({ ...p, [celda]: x.version }));
    ver.current = { ...ver.current, [celda]: x.version };
    setTextos((p) => ({ ...p, [celda]: x.texto }));
    if (x.conflicto) {
      // Otro la cambió mientras tanto: se muestra lo suyo, sin pisarlo.
      setValores((p) => ({ ...p, [celda]: x.valor }));
      v.current = { ...v.current, [celda]: x.valor };
      setConflictos((p) => ({ ...p, [celda]: `${x.por} cambió esto ${x.hace}` }));
      destellar([celda]);
      return;
    }
    setConflictos((p) => { const n = { ...p }; delete n[celda]; return n; });
    if (v.current[celda] === valor) setValores((p) => ({ ...p, [celda]: x.valor }));
    setGuardadoEn(new Date(x.guardadoEn));
    if (x.aviso) aviso({ mensaje: x.aviso });
    if (x.estado !== d.estado) router.refresh();
    if (otraVez.current[celda]) { otraVez.current[celda] = false; void guardar(celda); }
  }

  function cambiar(celda: Celda, valor: string, inmediato = false) {
    setValores((p) => ({ ...p, [celda]: valor }));
    v.current = { ...v.current, [celda]: valor };
    window.clearTimeout(timers.current[celda]);
    timers.current[celda] = window.setTimeout(() => void guardar(celda), inmediato ? 0 : 800);
  }

  /** Guardar ya todo lo pendiente (Ctrl+S, y antes de cualquier botón de la cabecera). */
  const guardarTodo = useCallback(async () => {
    const pendientes = Object.keys(timers.current) as Celda[];
    for (const c of pendientes) window.clearTimeout(timers.current[c]);
    await Promise.all(pendientes.map((c) => guardar(c)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modificar]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void guardarTodo().then(() => setGuardadoEn(new Date()));
      }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [guardarTodo]);

  // Tiempo real: lo que cambian los demás llega celda por celda (y destella).
  const traer = useRef<number | null>(null);
  const refrescarVivo = useCallback(() => {
    if (traer.current) window.clearTimeout(traer.current);
    traer.current = window.setTimeout(async () => {
      const r = await leerDocumentoVivo(d.id);
      if (!r.ok) return;
      const cambiadas: string[] = [];
      setValores((prev) => {
        const n = { ...prev };
        for (const [c, version] of Object.entries(r.datos.versiones)) {
          if ((ver.current[c] ?? 0) >= version || timers.current[c] || enVuelo.current[c] || foco.current === c) continue;
          n[c] = r.datos.valores[c] ?? "";
          cambiadas.push(c);
        }
        return n;
      });
      setTextos(r.datos.textos);
      setVersiones((prev) => {
        const n = { ...prev };
        for (const [c, version] of Object.entries(r.datos.versiones)) if (!timers.current[c] && !enVuelo.current[c] && foco.current !== c) n[c] = version;
        return n;
      });
      destellar(cambiadas);
      if (r.datos.estado !== d.estado) router.refresh();
    }, 250);
  }, [d.id, d.estado, router]);
  useEventosCambio((e) => {
    if (e === "reconexion" || (e.entidad === "ORDEN_COMPRA" && e.entidadId === d.id)) refrescarVivo();
  });

  // Presencia: "Alejandra, Camila están viendo".
  useEffect(() => {
    let vivo = true;
    const tic = async () => { const r = await latido(d.id); if (vivo && r.ok) setViendo(r.datos.viendo); };
    void tic();
    const t = window.setInterval(tic, 20_000);
    return () => { vivo = false; window.clearInterval(t); };
  }, [d.id]);

  const faltan = useMemo(() => (d.paso ? faltanPara(d.paso, valores) : []), [d.paso, valores]);
  const soloAcopio = d.yo.rol === "COMPRAS";
  const listas = useMemo(() => ({ ...d.listas, proveedoresVivos: proveedores, agregarProveedor: (p: ProveedorConSucursales) => setProveedores((xs) => [...xs.filter((x) => x.id !== p.id), p].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))) }), [d.listas, proveedores]);

  const celda = (c: Celda): ReactNode => (
    <>
      <EditorCelda celda={c} tipo={CELDAS[c].tipo} valor={valores[c] ?? ""} texto={textos[c] ?? ""} editable={editable(c)} onCambio={(x, i) => cambiar(c, x, i)}
        listas={listas} soloAcopio={c === "formaDePago" && soloAcopio} archivo={c === "facturaAdjunto" ? d.factura : undefined} ocId={d.id} />
      {(conflictos[c] || errores[c]) && <span className={`absolute right-0 -bottom-4 z-10 rounded px-1 font-sans text-[10px] leading-4 whitespace-nowrap ${errores[c] ? "bg-critico text-white" : "bg-[#FDF3E1] text-[#92600F]"}`}>{errores[c] ?? conflictos[c]}</span>}
    </>
  );
  const atributos = (c: Celda): AtributosCelda => ({
    "data-editable": editable(c) || undefined,
    "data-bloqueada": !editable(c) && CELDAS[c].tipo !== "lectura" ? true : undefined,
    "data-falta": faltan.includes(c) || undefined,
    "data-destello": destellos.has(c) || undefined,
    "data-conflicto": conflictos[c] ? true : undefined,
    onFocus: () => { foco.current = c; },
    onBlur: () => { if (foco.current === c) foco.current = null; },
  });

  return (
    <div className="-mx-4 -mt-4 min-h-[calc(100dvh-52px)] bg-[#F3F4F6] pb-6 lg:-m-6 lg:min-h-[calc(100dvh-var(--alto-header))]">
      <Cabecera d={d} volver={volver} guardarTodo={guardarTodo} modificar={modificar} setModificar={setModificar} />
      <div className="mx-auto flex w-full max-w-[794px] flex-col gap-3 px-4 pt-4 lg:px-0 lg:pt-6">
        <Avisos d={d} faltan={faltan} />
        <BarraAccion d={d} />
        <div className="flex min-h-6 flex-wrap items-center justify-between gap-2 text-[12px] text-suave">
          <span>{d.estado === "HABILITADA" && d.barraHabilitada ? "" : d.frase}</span>
          <span className="flex items-center gap-3">
            {viendo.length > 0 && (
              <span className="flex items-center gap-1.5" title={viendo.map((x) => x.nombre).join(", ")}>
                <span className="flex -space-x-1.5">{viendo.slice(0, 3).map((x) => <span key={x.id} className="grid size-6 place-items-center rounded-full bg-negro text-[11px] font-semibold text-white ring-2 ring-[#F3F4F6]">{x.nombre.slice(0, 1)}</span>)}</span>
                {viendo.map((x) => x.nombre.split(" ")[0]).join(", ")} {viendo.length === 1 ? "está viendo" : "están viendo"}
              </span>
            )}
            <span className="tabular-nums">{guardando > 0 ? "Guardando…" : guardadoEn ? `Guardado ${horaCorta(guardadoEn)}` : d.editables.length ? "Se guarda solo" : ""}</span>
          </span>
        </div>
      </div>
      <div className="mt-2 px-0 lg:px-6">
        <HojaOC
          titulo={d.hoja.titulo} color={d.hoja.color} celda={celda} atributos={atributos}
          factura={celda("facturaAdjunto")}
          autorizacion={<Autorizacion d={d} />}
          pago={<Pago d={d} />}
        />
      </div>
      <div className="mx-auto mt-6 flex w-full max-w-[794px] flex-col gap-6 px-4 lg:px-0">
        <DelPedido d={d} celda={celda} atributos={atributos} />
        {d.habilitaciones.length > 0 && <Habilitaciones d={d} />}
        {d.notasInternas !== null && <NotasInternas id={d.id} inicial={d.notasInternas} />}
        <Historia d={d} />
      </div>
    </div>
  );
}

// ─────────────────────────── Cabecera fija ───────────────────────────

function useAccion() {
  const router = useRouter();
  const aviso = useAviso();
  const [ocupado, setOcupado] = useState<string | null>(null);
  async function correr(clave: string, fn: () => Promise<Resultado<unknown>>, mensaje: string, deshacer?: () => Promise<Resultado<unknown>>) {
    setOcupado(clave);
    const r = await fn();
    setOcupado(null);
    if (!r.ok) {
      aviso({ mensaje: r.error, tono: "error" });
      return false;
    }
    aviso({ mensaje, deshacer: deshacer && (async () => { const x = await deshacer(); if (!x.ok) aviso({ mensaje: x.error, tono: "error" }); router.refresh(); }) });
    router.refresh();
    return true;
  }
  return { correr, ocupado };
}

function Cabecera({ d, volver, guardarTodo, modificar, setModificar }: { d: DocumentoPlantilla; volver: Volver; guardarTodo: () => Promise<void>; modificar: boolean; setModificar: (x: boolean) => void }) {
  const { correr, ocupado } = useAccion();
  const [hoja, setHoja] = useState<"devolver" | "anular" | "rechazar" | "mas" | null>(null);
  const a = d.acciones;
  const antes = async (fn: () => Promise<Resultado<unknown>>) => { await guardarTodo(); return fn(); };
  const principal = a.enviarAAutorizacion ? (
    <Boton cargando={ocupado === "aut"} icono={<Send />} onClick={() => correr("aut", () => antes(() => enviarAAutorizacion(d.id)), "Enviada a autorización. El dueño ya tiene el aviso.")}>Enviar a autorización</Boton>
  ) : a.enviarACompras ? (
    <Boton cargando={ocupado === "compras"} icono={<Send />} onClick={() => correr("compras", () => antes(() => enviarACompras(d.id)), "Enviada a Compras.")}>Enviar a Compras</Boton>
  ) : a.aprobar ? (
    <Boton cargando={ocupado === "aprobar"} icono={<Stamp />} onClick={() => correr("aprobar", () => aprobarDocumento(d.id), "Autorizada.", () => deshacerAprobacion(d.id))}>Aprobar</Boton>
  ) : null;
  const secundarias = (
    <>
      {a.modificar && <Boton variante={modificar ? "primario" : "secundario"} icono={<PenLine />} onClick={() => setModificar(!modificar)}>{modificar ? "Listo" : "Modificar"}</Boton>}
      {a.presupuesto !== null && (
        <Boton variante="secundario" cargando={ocupado === "pres"} icono={a.presupuesto ? <Check /> : undefined} onClick={() => correr("pres", () => marcarPresupuestoSolicitado(d.id, !a.presupuesto), a.presupuesto ? "Desmarcado." : "Marcada: en el tablero queda como Solicitud de presupuesto.")}>
          {a.presupuesto ? "Presupuesto pedido" : "Pedí presupuesto"}
        </Boton>
      )}
      {a.devolver && <Boton variante="secundario" icono={<CornerUpLeft />} onClick={() => setHoja("devolver")}>Devolver a quien pidió</Boton>}
      {a.aprobar && <Boton variante="secundario" onClick={() => setHoja("rechazar")}>Rechazar</Boton>}
      <a href={`/api/oc/${d.id}/pdf`} target="_blank" rel="noopener" className={claseBoton("secundario")}><FileDown /> Imprimir / PDF</a>
      {a.anular && <Boton variante="fantasma" icono={<Ban />} onClick={() => setHoja("anular")}>Anular</Boton>}
    </>
  );
  return (
    <header className="pt-segura sticky top-[calc(52px+env(safe-area-inset-top))] z-20 border-b border-linea bg-papel lg:top-[var(--alto-header)]">
      <div className="grid min-h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-2 lg:px-6">
        <VolverA clave={volver.clave} href={volver.href} etiqueta={volver.etiqueta} className="pl-2" />
        <div className="flex min-w-0 items-center justify-center gap-2">
          <span data-numero className="truncate text-[15px] font-semibold tabular-nums">{d.nombre}</span>
          <Insignia tono={d.estadoTono}>{d.estadoTitulo}</Insignia>
        </div>
        <div className="flex items-center justify-end gap-2">
          <div className="hidden items-center gap-2 xl:flex">{secundarias}</div>
          {principal}
          <button type="button" onClick={() => setHoja("mas")} aria-label="Más acciones" className="grid size-10 place-items-center rounded-md border border-linea xl:hidden"><MoreHorizontal className="size-4" /></button>
        </div>
      </div>
      <Hoja abierta={hoja === "mas"} onCerrar={() => setHoja(null)} titulo={d.nombre}>
        <div className="flex flex-col gap-2 [&>*]:w-full">{secundarias}</div>
      </Hoja>
      <Hoja abierta={hoja === "devolver"} onCerrar={() => setHoja(null)} titulo="Devolver a quien pidió">
        {hoja === "devolver" && <Motivo etiqueta="¿Qué falta o qué hay que cambiar?" boton="Devolver" enviar={(m) => correr("dev", () => devolverASolicitante(d.id, m), "Devuelta. Le llegó el aviso con tu nota.")} cerrar={() => setHoja(null)} />}
      </Hoja>
      <Hoja abierta={hoja === "anular"} onCerrar={() => setHoja(null)} titulo={`Anular ${d.nombre}`}>
        {hoja === "anular" && <Motivo etiqueta="¿Por qué se anula?" boton="Anular" peligro enviar={(m) => correr("anular", () => anularDocumento(d.id, m), "Anulada.")} cerrar={() => setHoja(null)} />}
      </Hoja>
      <Hoja abierta={hoja === "rechazar"} onCerrar={() => setHoja(null)} titulo={`Rechazar ${d.nombre}`}>
        {hoja === "rechazar" && <Motivo etiqueta="Motivo (lo ve Compras arriba de la orden)" boton="Rechazar" peligro enviar={(m) => correr("rech", () => rechazarDocumento(d.id, m), "Rechazada: vuelve a Compras con el motivo.")} cerrar={() => setHoja(null)} />}
      </Hoja>
    </header>
  );
}

function Motivo({ etiqueta, boton, enviar, cerrar, peligro = false }: { etiqueta: string; boton: string; enviar: (m: string) => Promise<boolean>; cerrar: () => void; peligro?: boolean }) {
  const [m, setM] = useState("");
  const [enviando, setEnviando] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-[12px] font-medium text-suave">{etiqueta}<AreaTexto autoFocus rows={3} value={m} onChange={(e) => setM(e.target.value)} maxLength={1000} /></label>
      <Boton variante={peligro ? "peligro" : "primario"} cargando={enviando} disabled={m.trim().length < 3} onClick={async () => { setEnviando(true); const ok = await enviar(m); setEnviando(false); if (ok) cerrar(); }}>{boton}</Boton>
    </div>
  );
}

// ─────────────────────────── Avisos arriba de la hoja ───────────────────────────

function Avisos({ d, faltan }: { d: DocumentoPlantilla; faltan: Celda[] }) {
  const linea = faltan.length ? `Faltan: ${faltan.map((c) => CELDAS[c].etiqueta.replace(/^1\.1 /, "")).join(", ")}` : null;
  return (
    <>
      {d.motivoRechazo && <p className="flex items-start gap-2 rounded-md bg-critico-fondo px-3 py-2 text-sm text-critico"><AlertTriangle className="mt-0.5 size-4 shrink-0" /> El dueño la rechazó: {d.motivoRechazo}</p>}
      {d.notaDevolucion && <p className="flex items-start gap-2 rounded-md bg-aviso-fondo px-3 py-2 text-sm text-aviso-texto"><CornerUpLeft className="mt-0.5 size-4 shrink-0" /> Compras te la devolvió: {d.notaDevolucion}</p>}
      {d.motivoAnulacion && <p className="rounded-md bg-black/[0.05] px-3 py-2 text-sm text-suave">Anulada: {d.motivoAnulacion}</p>}
      {linea && <p className="text-sm font-medium text-critico">{linea}</p>}
    </>
  );
}

// ─────────────────────────── Barra de acción: encargada y habilitada ───────────────────────────

function BarraAccion({ d }: { d: DocumentoPlantilla }) {
  const { correr, ocupado } = useAccion();
  const [habilitar, setHabilitar] = useState(false);
  const a = d.acciones;
  const verde = d.estado === "HABILITADA" && d.barraHabilitada;
  if (!verde && !a.encargar && !a.desencargar && !a.habilitar && !a.pedirViaje) return null;
  return (
    <section className={`flex flex-col gap-3 rounded-[var(--radius-caja)] border p-4 sm:flex-row sm:items-center ${verde ? "border-[#B9DCC7] bg-[#E2EFDA]" : "border-linea bg-papel"}`}>
      {verde ? (
        <p className="flex min-w-0 flex-1 items-center gap-2 text-[15px] font-semibold text-[#375623]"><Truck className="size-5 shrink-0" /> {d.barraHabilitada}</p>
      ) : (
        <ol className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-sm">
          <li className="flex items-center gap-2">
            {a.desencargar ? <span className="flex items-center gap-1.5 font-medium text-ok"><Check className="size-4" /> Encargada</span> : (
              <Boton tamano="grande" variante="secundario" cargando={ocupado === "enc"} icono={<PackageCheck />} onClick={() => correr("enc", () => marcarEncargada(d.id, true), "Marcada como encargada.")}>1. Marcar como encargada</Boton>
            )}
          </li>
          {a.habilitar && <li><Boton tamano="grande" icono={<PackageOpen />} onClick={() => setHabilitar(true)}>2. Habilitar para retirar</Boton></li>}
        </ol>
      )}
      {verde && a.habilitar && <Boton variante="secundario" icono={<PackageOpen />} onClick={() => setHabilitar(true)}>Habilitar otra parte</Boton>}
      {a.desencargar && !verde && <Boton variante="fantasma" cargando={ocupado === "desenc"} onClick={() => correr("desenc", () => marcarEncargada(d.id, false), "Desmarcada.")}>Desmarcar encargada</Boton>}
      {a.pedirViaje && <BotonLink href={`/pedir/retiro?obra=${a.pedirViaje.obraId}&material=${a.pedirViaje.materialId}`} icono={<Truck />}>Pedir el viaje</BotonLink>}
      <Hoja abierta={habilitar} onCerrar={() => setHabilitar(false)} titulo="Habilitar para retirar">
        {habilitar && (
          <FormHabilitar id={d.id} proveedores={d.listas.proveedores} oc={d.habilitar.numero} descripcion={d.habilitar.descripcion} destino={d.habilitar.destino}
            ocAprobada={{ proveedorId: d.habilitar.proveedorId, sucursalId: d.habilitar.sucursalId, numero: d.habilitar.numero, renglones: d.habilitar.renglones }} cerrar={() => setHabilitar(false)} />
        )}
      </Hoja>
    </section>
  );
}

// ─────────────────────────── Secciones 2 y 4 ───────────────────────────

function Autorizacion({ d }: { d: DocumentoPlantilla }) {
  const { correr, ocupado } = useAccion();
  const h = d.hoja.autorizacion;
  return (
    <div className="flex h-full flex-col gap-1">
      {h.por ? <p className="text-[13px] font-bold text-[#1F7A4D]">AUTORIZADA por {h.por}</p> : h.texto ? <p>{h.texto}</p> : null}
      {h.en && <p className="text-[11px]">{h.en}</p>}
      {d.acciones.aprobar && (
        <div className="mt-auto flex gap-2 font-sans">
          <Boton tamano="chico" cargando={ocupado === "ap"} icono={<Stamp />} onClick={() => correr("ap", () => aprobarDocumento(d.id), "Autorizada.", () => deshacerAprobacion(d.id))}>Aprobar</Boton>
        </div>
      )}
    </div>
  );
}

function Pago({ d }: { d: DocumentoPlantilla }) {
  const { correr, ocupado } = useAccion();
  const p = d.hoja.pago;
  return (
    <>
      {p.autorizadoPor ? (
        <>
          <p className="text-[13px] font-bold text-[#1F7A4D]">AUTORIZADO</p>
          <p>por {p.autorizadoPor}</p>
          <p className="text-[11px]">{p.en}</p>
        </>
      ) : d.acciones.pagoPedido ? <p>{d.acciones.pagoPedido}</p> : null}
      <div className="mt-1 flex flex-col gap-1 font-sans">
        {d.acciones.pedirPago && <Boton tamano="chico" variante="secundario" cargando={ocupado === "pp"} onClick={() => correr("pp", () => pedirAutorizacionPago(d.id), "Pedido al dueño. Le llegó el aviso.")}>Pedir autorización</Boton>}
        {d.acciones.autorizarPago && <Boton tamano="chico" cargando={ocupado === "ap"} icono={<Stamp />} onClick={() => correr("ap", () => autorizarPago(d.id), "Pago autorizado.")}>Autorizar pago</Boton>}
      </div>
    </>
  );
}

// ─────────────────────────── Debajo de la hoja ───────────────────────────

function DelPedido({ d, celda, atributos }: { d: DocumentoPlantilla; celda: (c: Celda) => ReactNode; atributos: (c: Celda) => AtributosCelda }) {
  const router = useRouter();
  const aviso = useAviso();
  // Cada archivo se engancha al documento apenas termina de subir (sin un segundo botón que se olvidaba).
  const [vuelta, setVuelta] = useState(0);
  const enganchando = useRef(false);
  const enviados = useRef(new Set<string>());
  const puedeAdjuntar = d.estado !== "ANULADA" && (d.editables.length > 0 || d.yo.rol === "COMPRAS");
  async function enganchar(ids: string[], subiendo: boolean) {
    const nuevos = ids.filter((id) => !enviados.current.has(id));
    if (subiendo || !nuevos.length || enganchando.current) return;
    enganchando.current = true;
    nuevos.forEach((id) => enviados.current.add(id));
    const r = await adjuntarADocumento(d.id, nuevos);
    enganchando.current = false;
    if (!r.ok) {
      nuevos.forEach((id) => enviados.current.delete(id));
      return aviso({ mensaje: r.error, tono: "error" });
    }
    if (!r.datos.cantidad) return;
    setVuelta((x) => x + 1);
    const archivos = r.datos.cantidad === 1 ? "Archivo adjuntado" : `${r.datos.cantidad} archivos adjuntados`;
    aviso({ mensaje: r.datos.transcritos ? `${archivos}: ${r.datos.transcritos} ${r.datos.transcritos === 1 ? "material pasó" : "materiales pasaron"} al Detalle del Pedido.` : `${archivos}.` });
    router.refresh();
  }
  return (
    <section className="flex flex-col gap-3">
      <h2 className="etiqueta">Del pedido</h2>
      <div className="grid gap-px overflow-hidden rounded-[var(--radius-caja)] border border-linea bg-linea sm:grid-cols-[180px_minmax(0,1fr)]">
        <div className="flex items-center bg-papel px-3 text-[12px] text-suave">Prioridad</div>
        <div className="hoja-valor min-h-10 bg-papel" {...atributos("prioridad")}>{celda("prioridad")}</div>
        <div className="flex items-start bg-papel px-3 pt-2.5 text-[12px] text-suave">Observaciones de quien pidió</div>
        <div className="hoja-valor min-h-16 items-start bg-papel" {...atributos("observacionesSolicitante")}>{celda("observacionesSolicitante")}</div>
      </div>
      <ListaAdjuntos adjuntos={d.adjuntos} />
      {puedeAdjuntar && (
        <SubirAdjuntos key={vuelta} entidadTipo="ORDEN_COMPRA" etiqueta="Adjuntar lista, presupuesto o foto" compacto onCambio={(x, s) => void enganchar(x, s)} />
      )}
    </section>
  );
}

function Habilitaciones({ d }: { d: DocumentoPlantilla }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="etiqueta">Habilitado para retirar</h2>
      <ul className="divide-y divide-linea rounded-[var(--radius-caja)] border border-linea bg-papel">
        {d.habilitaciones.map((h) => (
          <li key={h.id} className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
            <span className="min-w-0 flex-1"><span className="font-medium">{h.descripcion}</span><span className="block text-suave">{h.proveedor}{h.sucursal !== "Casa central" ? ` (${h.sucursal})` : ""} · {h.modo === "ENTREGA_PROVEEDOR" ? `${MODO_ENTREGA[h.modo]}${h.entrega ? ` el ${h.entrega}` : ""}` : h.horario ?? MODO_ENTREGA[h.modo]}{h.viaje ? ` · viaje #${h.viaje.numero}${h.viaje.chofer ? ` (${h.viaje.chofer})` : ""}` : ""}</span></span>
            <Insignia tono={ESTADO_RETIRO[h.estado].tono}>{ESTADO_RETIRO[h.estado].titulo}</Insignia>
          </li>
        ))}
      </ul>
    </section>
  );
}

function NotasInternas({ id, inicial }: { id: string; inicial: string }) {
  const aviso = useAviso();
  const [t, setT] = useState(inicial);
  const [guardado, setGuardado] = useState(inicial);
  return (
    <section className="flex flex-col gap-2">
      <h2 className="etiqueta">Notas internas de Compras (quien pidió no las ve)</h2>
      <AreaTexto rows={3} value={t} onChange={(e) => setT(e.target.value)} maxLength={3000}
        onBlur={async () => { if (t === guardado) return; const r = await guardarNotasInternas(id, t); if (!r.ok) return aviso({ mensaje: r.error, tono: "error" }); setGuardado(t); }} />
    </section>
  );
}

/** Línea de tiempo del documento y el panel plegable "Cambios" (celda por celda). */
function Historia({ d }: { d: DocumentoPlantilla }) {
  const [abierto, setAbierto] = useState(false);
  const [cambios, setCambios] = useState<{ celda: string; etiqueta: string; anterior: string | null; nuevo: string | null; quien: string; fecha: string }[] | null>(null);
  const paso = ordenPaso(d.estado);
  return (
    <section className="flex flex-col gap-3">
      <h2 className="etiqueta">Recorrido</h2>
      <ol className="flex flex-wrap gap-1.5 text-[12px]">
        {PASOS_DOC.map((p, i) => (
          <li key={p.estado} className={`rounded-full px-2.5 py-1 ${d.estado === "ANULADA" ? "bg-black/[0.04] text-suave" : i < paso ? "bg-ok-fondo text-ok" : i === paso ? "bg-negro text-white" : "bg-black/[0.04] text-suave"}`}>{p.titulo}</li>
        ))}
      </ol>
      <ul className="flex flex-col gap-1 text-[13px]">
        {d.lineaDeTiempo.slice().reverse().map((c, i) => (
          <li key={i} className="flex gap-2"><span className="w-28 shrink-0 text-suave tabular-nums">{new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(c.fecha))}</span><span><b className="font-medium">{ESTADO_DOC[c.a].titulo}</b>{c.nota ? ` · ${c.nota}` : ""}{c.quien ? <span className="text-suave"> · {c.quien}</span> : null}</span></li>
        ))}
      </ul>
      <button type="button" aria-expanded={abierto} onClick={async () => { setAbierto(!abierto); if (!cambios) { const r = await historialCeldas(d.id); if (r.ok) setCambios(r.datos); } }}
        className="flex min-h-10 items-center gap-2 self-start rounded-md border border-linea bg-papel px-3 text-sm font-medium hover:bg-hover">
        <History className="size-4" /> Cambios celda por celda <ChevronDown className={`size-4 ${abierto ? "rotate-180" : ""}`} />
      </button>
      {abierto && (
        <ul className="divide-y divide-linea rounded-[var(--radius-caja)] border border-linea bg-papel text-[13px]">
          {cambios === null && <li className="px-4 py-3 text-suave">Cargando…</li>}
          {cambios?.length === 0 && <li className="px-4 py-3 text-suave">Todavía nadie cambió ninguna celda.</li>}
          {cambios?.map((c, i) => (
            <li key={i} className="flex flex-col gap-0.5 px-4 py-2.5">
              <span><b className="font-medium">{c.etiqueta}</b> <span className="text-suave">· {c.quien} · {new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(c.fecha))}</span></span>
              <span className="text-suave">{c.anterior ? <><s>{c.anterior.slice(0, 140)}</s> → </> : null}<span className="text-tinta">{c.nuevo?.slice(0, 140) ?? "(vacía)"}</span></span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
