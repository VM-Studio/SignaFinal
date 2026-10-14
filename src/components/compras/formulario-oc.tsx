"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Eye, FileSpreadsheet, ListPlus, Plus, Save, Send, UserPlus, X } from "lucide-react";
import type { CondicionPago, FormaPago, SemaforoPE } from "@prisma/client";
import { Boton } from "@/components/ui/boton";
import { Hoja } from "@/components/ui/hoja";
import { Combobox } from "@/components/ui/combobox";
import { AreaTexto, Entrada, Fecha, MensajeError, Selector } from "@/components/ui/campos";
import { Opciones } from "@/components/ui/opciones";
import { useAviso } from "@/components/ui/avisos";
import { SubirAdjuntos } from "@/components/adjuntos/subir";
import { ListaAdjuntos } from "@/components/adjuntos/lista";
import { SelectorProveedorSucursal, type ValorProveedor } from "@/components/proveedores/selector";
import { guardarOC, importarPlanilla } from "@/lib/compras/acciones";
import { crearSolicitanteExterno } from "@/lib/compras/configuracion";
import { CONDICION_PAGO, FORMA_PAGO, TIPO_ORDEN } from "@/lib/compras/estados";
import { SEMAFORO_PE } from "@/lib/compras/estadoTablero";
import { pasarARenglones } from "@/lib/compras/renglones";
import type { FormularioOCDatos } from "@/lib/compras/consultas";
import type { DatosOC } from "@/lib/compras/esquema";
import type { RenglonImportado } from "@/lib/compras/importar";
import { diaISO } from "@/lib/formato";

type Renglon = { descripcion: string; cantidad: string; unidad: string; precio: string };
const UNIDADES = ["u", "bolsas", "m", "m²", "m³", "kg", "barras", "rollos", "cajas", "litros", "pallets", "tn", "latas", "placas"];
const vacio: Renglon = { descripcion: "", cantidad: "", unidad: "u", precio: "" };
const numTexto = (n: number | null | undefined) => (n == null ? "" : n.toLocaleString("es-AR", { maximumFractionDigits: 2 }));
const masDias = (d: string, n: number) => {
  const x = new Date(`${d}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
const PLANILLA = /\.(xlsx|csv)$/i;

/** Una fila de la ficha (como el bloque del Excel): la etiqueta a la izquierda y el valor a la derecha. */
function Fila({ etiqueta, htmlFor, children, ayuda }: { etiqueta: string; htmlFor?: string; children: ReactNode; ayuda?: ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-linea py-3 last:border-0 sm:grid-cols-[170px_minmax(0,1fr)] sm:items-start sm:gap-4">
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-suave sm:pt-2">{etiqueta}</label>
      <div className="min-w-0">{children}{ayuda && <p className="mt-1 text-[12px] text-suave">{ayuda}</p>}</div>
    </div>
  );
}

function Seccion({ titulo, children, plegable = false, abierta: inicial = true, detalle }: { titulo: string; children: ReactNode; plegable?: boolean; abierta?: boolean; detalle?: string }) {
  const [abierta, setAbierta] = useState(inicial);
  return (
    <section className="rounded-[var(--radius-caja)] border border-linea bg-papel">
      {plegable ? (
        <button type="button" onClick={() => setAbierta(!abierta)} aria-expanded={abierta} className="flex w-full items-center gap-2 px-4 py-3 text-left">
          <span className="text-[15px] font-semibold">{titulo}</span>
          {detalle && <span className="text-[13px] text-suave">{detalle}</span>}
          <ChevronDown className={`ml-auto size-4 text-suave transition-transform ${abierta ? "rotate-180" : ""}`} />
        </button>
      ) : (
        <h2 className="px-4 pt-3 text-[15px] font-semibold">{titulo}</h2>
      )}
      {abierta && <div className="px-4 pb-1">{children}</div>}
    </section>
  );
}

/**
 * LA PLANTILLA de Alejandra (OC o PE): las secciones, las etiquetas y el orden de su bloque del Excel,
 * con aspecto de ficha. "Guardar" deja el borrador en Órdenes (sin número); "Vista previa PDF" lo
 * genera con marca BORRADOR; "Enviar a aprobación" asigna OC-NNNN / PE-NNNN, genera el PDF y le avisa
 * al dueño. Una orden ya autorizada se edita acá: si cambia proveedor final, importe, materiales,
 * forma o condición de pago vuelve a aprobación (v2); facturación u orden de pago, no.
 */
export function FormularioOC({ d }: { d: FormularioOCDatos }) {
  const router = useRouter();
  const aviso = useAviso();
  const o = d.orden;
  const p = d.pedido;
  const enviada = !!o && o.estado !== "BORRADOR";
  const [ocId, setOcId] = useState<string | null>(o?.id ?? null);
  const [tipo, setTipo] = useState<"OC" | "PE">(o?.tipo ?? d.tipoInicial);
  const [semaforo, setSemaforo] = useState<SemaforoPE>(o?.semaforoPE ?? "NADA_TODAVIA");
  const [empresa, setEmpresa] = useState(o?.empresaCompraId ?? d.empresaPorDefecto ?? "");
  const [fecha, setFecha] = useState(o?.fecha ?? diaISO());
  const [caducidad, setCaducidad] = useState(o?.fechaNecesaria ?? p?.paraCuando ?? masDias(diaISO(), 7));
  const [solicitantes, setSolicitantes] = useState(d.solicitantes);
  const [solicitado, setSolicitado] = useState<string | null>(o?.solicitadoPorValor ?? (p ? `u:${p.solicitanteId}` : null));
  const [nuevoNombre, setNuevoNombre] = useState<string | null>(null);
  const [obraId, setObraId] = useState<string | null>(o?.obraId ?? p?.obraId ?? null);
  const [sedeId, setSedeId] = useState<string | null>(p?.obraSedeId ?? null);
  const [detalle, setDetalle] = useState(o?.detallePedido ?? (p && !o ? p.descripcion : ""));
  const renglonesIniciales: Renglon[] = o?.renglones.length
    ? o.renglones.map((r) => ({ descripcion: r.descripcion, cantidad: numTexto(r.cantidad), unidad: r.unidad, precio: numTexto(r.precioUnitario) }))
    : !o && p?.renglones.length ? p.renglones.map((r) => ({ descripcion: r.descripcion, cantidad: r.cantidad != null ? numTexto(r.cantidad) : "", unidad: r.unidad ?? "u", precio: "" })) : [];
  const [renglones, setRenglones] = useState<Renglon[]>(renglonesIniciales);
  const [sugerido, setSugerido] = useState(o?.proveedorSugerido ?? "");
  const [prov, setProv] = useState<ValorProveedor>({ proveedorId: o?.proveedorId ?? null, sucursalId: o?.sucursalId ?? null });
  const [presupuesto, setPresupuesto] = useState(o?.presupuestoNumero ?? "");
  const [importe, setImporte] = useState(numTexto(o?.importe));
  const [aConfirmar, setAConfirmar] = useState(o?.importeAConfirmar ?? false);
  const [moneda, setMoneda] = useState<"ARS" | "USD">(o?.moneda ?? "ARS");
  const [forma, setForma] = useState<FormaPago | undefined>(o?.formaPago ?? undefined);
  const [condicion, setCondicion] = useState<CondicionPago | undefined>(o?.condicionPago ?? undefined);
  const [condicionTexto, setCondicionTexto] = useState(o?.condicionPagoTexto ?? "");
  const [entrega, setEntrega] = useState(o?.fechaEntrega ?? "");
  const [observaciones, setObservaciones] = useState(o?.observaciones ?? (p && !o ? p.observaciones ?? "" : ""));
  const [notas, setNotas] = useState(o?.notasInternas ?? p?.notasCompras ?? "");
  // 3. Facturación
  const [facEmpresa, setFacEmpresa] = useState(o?.empresaFacturarId ?? "");
  const [facNumero, setFacNumero] = useState(o?.facturaNumero ?? "");
  const [facImporte, setFacImporte] = useState(numTexto(o?.facturaImporte));
  const [facFecha, setFacFecha] = useState(o?.facturaFecha ?? "");
  const [facForma, setFacForma] = useState<FormaPago | "">(o?.facturaFormaPago ?? "");
  const [facCondicion, setFacCondicion] = useState<CondicionPago | "">(o?.facturaCondicion ?? "");
  const [facAdjunto, setFacAdjunto] = useState<string | null>(o?.facturaAdjuntoId ?? null);
  // 4. Orden de pago
  const [fechaPago, setFechaPago] = useState(o?.fechaPago ?? "");
  const [pagoImporte, setPagoImporte] = useState(numTexto(o?.pagoImporte));
  const [pagoObs, setPagoObs] = useState(o?.pagoObservaciones ?? "");

  const [adjuntos, setAdjuntos] = useState<string[]>([]);
  const [adjFactura, setAdjFactura] = useState<string[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState<"guardar" | "enviar" | "vista" | null>(null);
  const [vista, setVista] = useState<string | null>(null);
  const [importar, setImportar] = useState<{ nombre: string; filas: RenglonImportado[] | null; motivo?: string } | null>(null);

  const obra = d.obras.find((x) => x.id === obraId) ?? null;
  const destino = (obra?.sedes.find((s) => s.id === sedeId)?.destino ?? obra?.destino) || p?.destino || null;
  const planillas = d.adjuntosPedido.filter((a) => PLANILLA.test(a.nombre));
  const razonFacturar = d.razones.find((r) => r.id === facEmpresa);
  const cambiar = (i: number, c: Partial<Renglon>) => setRenglones((x) => x.map((r, j) => (j === i ? { ...r, ...c } : r)));
  const sumaRenglones = useMemo(() => {
    const n = (s: string) => Number(s.replace(/\./g, "").replace(",", "."));
    const con = renglones.filter((r) => r.descripcion.trim() && r.precio.trim() && Number.isFinite(n(r.precio)) && Number.isFinite(n(r.cantidad)));
    return con.length ? con.reduce((s, r) => s + n(r.cantidad) * n(r.precio), 0) : null;
  }, [renglones]);

  const datos = (): DatosOC => ({
    id: ocId ?? undefined, tipo, pedidoMaterialId: p?.id, empresaCompraId: empresa || undefined,
    fecha, fechaNecesaria: caducidad || undefined, fechaEntrega: entrega || undefined,
    solicitadoPor: solicitado ?? undefined, obraId: obraId ?? undefined, obraSedeId: sedeId ?? undefined,
    detallePedido: detalle, renglones: renglones.map((r) => ({ descripcion: r.descripcion, cantidad: r.cantidad, unidad: r.unidad, precioUnitario: r.precio })),
    proveedorSugerido: sugerido, proveedorId: prov.proveedorId ?? undefined, sucursalId: prov.sucursalId ?? undefined,
    presupuestoNumero: presupuesto, importe, importeAConfirmar: aConfirmar, moneda,
    formaPago: forma, condicionPago: condicion, condicionPagoTexto: condicionTexto, observaciones, notasInternas: notas,
    semaforoPE: tipo === "PE" ? semaforo : undefined,
    empresaFacturarId: facEmpresa || undefined, facturaNumero: facNumero, facturaImporte: facImporte, facturaFecha: facFecha || undefined,
    facturaFormaPago: facForma || undefined, facturaCondicion: facCondicion || undefined, facturaAdjuntoId: facAdjunto ?? undefined,
    fechaPago: fechaPago || undefined, pagoImporte, pagoObservaciones: pagoObs, adjuntos: [...new Set([...adjuntos, ...adjFactura])],
  });

  async function guardar(enviar: boolean) {
    setError(undefined);
    if (subiendo) return setError("Esperá a que terminen de subir los archivos.");
    setEnviando(enviar ? "enviar" : "guardar");
    const r = await guardarOC(datos(), enviar);
    setEnviando(null);
    if (!r.ok) return setError(r.error);
    setOcId(r.datos.id);
    setAdjuntos([]);
    setAdjFactura([]);
    if (enviar) {
      aviso({ mensaje: `${r.datos.numero} enviada a aprobación. Le llegó al dueño.` });
      router.push(`/compras/ordenes?ver=${r.datos.id}`);
    } else if (r.datos.reaprobacion) {
      aviso({ mensaje: "Guardada. Cambió algo de fondo: vuelve a aprobación con una versión nueva." });
      router.push(`/compras/ordenes?ver=${r.datos.id}`);
    } else {
      aviso({ mensaje: enviada ? "Cambios guardados." : "Guardada en Órdenes como borrador. La podés retomar cuando quieras." });
      if (!ocId) router.replace(`/compras/ordenes/${r.datos.id}`);
      else router.refresh();
    }
  }

  async function verPDF() {
    setEnviando("vista");
    setError(undefined);
    try {
      const r = await fetch("/api/oc/vista-previa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(datos()) });
      if (!r.ok) throw new Error(((await r.json().catch(() => null)) as { error?: string } | null)?.error ?? "No se pudo generar la vista previa.");
      if (vista) URL.revokeObjectURL(vista);
      setVista(URL.createObjectURL(await r.blob()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar la vista previa. Probá de nuevo.");
    } finally {
      setEnviando(null);
    }
  }

  async function agregarNombre() {
    if (!nuevoNombre?.trim()) return;
    const r = await crearSolicitanteExterno(nuevoNombre);
    if (!r.ok) return aviso({ mensaje: r.error, tono: "error" });
    setSolicitantes((xs) => (xs.some((x) => x.valor === `e:${r.datos.id}`) ? xs : [...xs, { valor: `e:${r.datos.id}`, nombre: r.datos.nombre, detalle: "sin usuario" as const }].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))));
    setSolicitado(`e:${r.datos.id}`);
    setNuevoNombre(null);
  }

  async function leerPlanilla(a: { id: string; nombre: string }) {
    setImportar({ nombre: a.nombre, filas: null });
    const r = await importarPlanilla(a.id);
    if (!r.ok) return setImportar({ nombre: a.nombre, filas: [], motivo: r.error });
    setImportar(r.datos.ok ? { nombre: a.nombre, filas: r.datos.renglones } : { nombre: a.nombre, filas: [], motivo: r.datos.motivo });
  }

  const opcionesForma = (Object.keys(FORMA_PAGO) as FormaPago[]).map((m) => ({ valor: m, titulo: FORMA_PAGO[m] }));
  const opcionesCondicion = (Object.keys(CONDICION_PAGO) as CondicionPago[]).map((m) => ({ valor: m, titulo: CONDICION_PAGO[m] }));

  return (
    <div className="flex flex-col gap-4 pb-4">
      {/* ── Encabezado: tipo, número y empresa ── */}
      <section className="grid gap-3 rounded-[var(--radius-caja)] border border-linea bg-papel p-4 sm:grid-cols-3">
        <div>
          <p className="mb-1 text-[13px] font-medium text-suave">Tipo</p>
          {o?.numero ? (
            <p className="text-[15px] font-semibold">{TIPO_ORDEN[tipo].titulo}</p>
          ) : (
            <Opciones nombre="Tipo de orden" columnas={2} valor={tipo} onElegir={(v) => setTipo(v as "OC" | "PE")} opciones={[{ valor: "OC", titulo: "OC", detalle: "orden de compra" }, { valor: "PE", titulo: "PE", detalle: "pedido especial" }]} />
          )}
        </div>
        <div>
          <p className="mb-1 text-[13px] font-medium text-suave">N° de Orden</p>
          <p className={`text-[22px] font-semibold tabular-nums ${o?.numero ? "" : "text-suave"}`}>{o?.numero ? `${o.numero}${o.versionAprobacion > 1 ? ` v${o.versionAprobacion}` : ""}` : "Se asigna al enviar"}</p>
        </div>
        <div>
          <label htmlFor="oc-empresa" className="mb-1 block text-[13px] font-medium text-suave">Empresa (la que compra)</label>
          <Selector id="oc-empresa" value={empresa} onChange={(e) => setEmpresa(e.target.value)}>
            <option value="">Elegí la razón social</option>
            {d.razones.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </Selector>
        </div>
        {tipo === "PE" && (
          <div className="sm:col-span-3">
            <p className="mb-1 text-[13px] font-medium text-suave">Estado de la orden</p>
            <Opciones nombre="Estado del pedido especial" columnas={4} valor={semaforo} onElegir={(v) => setSemaforo(v as SemaforoPE)}
              opciones={(Object.keys(SEMAFORO_PE) as SemaforoPE[]).map((s) => ({ valor: s, titulo: SEMAFORO_PE[s].titulo, detalle: SEMAFORO_PE[s].detalle || undefined }))} />
          </div>
        )}
      </section>

      {/* ── 1. Orden de Pedido ── */}
      <Seccion titulo="1. Orden de Pedido">
        <Fila etiqueta="Fecha del pedido" htmlFor="oc-fecha"><Fecha id="oc-fecha" value={fecha} onChange={(e) => { const v = e.target.value; if (!o && caducidad === masDias(fecha, 7)) setCaducidad(masDias(v, 7)); setFecha(v); }} /></Fila>
        <Fila etiqueta="Fecha de caducidad" htmlFor="oc-cad" ayuda="Para cuándo tiene que estar. Por defecto, una semana después del pedido."><Fecha id="oc-cad" value={caducidad} onChange={(e) => setCaducidad(e.target.value)} /></Fila>
        <Fila etiqueta="Solicitado por">
          <Combobox etiquetaOculta etiqueta="Solicitado por" placeholder="Buscar por nombre" valor={solicitado} onElegir={setSolicitado}
            items={solicitantes.map((s) => ({ id: s.valor, titulo: s.nombre, detalle: s.detalle === "sin usuario" ? "sin usuario" : undefined }))}
            vacio="No está en la lista: agregalo con “+ otro nombre”."
            accion={<Boton variante="secundario" icono={<UserPlus />} onClick={() => setNuevoNombre("")} className="shrink-0">+ otro nombre</Boton>} />
          {nuevoNombre != null && (
            <div className="mt-2 flex gap-2">
              <Entrada aria-label="Nombre" placeholder="Nombre (no se le crea usuario)" value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} maxLength={60} autoFocus onKeyDown={(e) => e.key === "Enter" && agregarNombre()} />
              <Boton variante="secundario" onClick={agregarNombre} disabled={!nuevoNombre.trim()}>Agregar</Boton>
              <Boton variante="fantasma" aria-label="Cancelar" onClick={() => setNuevoNombre(null)}><X /></Boton>
            </div>
          )}
        </Fila>
        <Fila etiqueta="Obra">
          {p ? (
            <p className="pt-2 font-medium">Obra {p.obra}{p.sede ? ` · ${p.sede}` : ""}</p>
          ) : (
            <div className="flex flex-col gap-2">
              <Combobox etiquetaOculta etiqueta="Obra" placeholder="Buscar obra" valor={obraId} onElegir={(id) => { setObraId(id); setSedeId(null); const ob = d.obras.find((x) => x.id === id); if (ob?.razonSocialId && !o) setEmpresa(ob.razonSocialId); }}
                items={d.obras.map((x) => ({ id: x.id, titulo: x.nombre }))} />
              {obra && obra.sedes.length > 0 && (
                <Selector aria-label="Sede" value={sedeId ?? ""} onChange={(e) => setSedeId(e.target.value || null)}>
                  <option value="">La obra (sin sede)</option>
                  {obra.sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </Selector>
              )}
            </div>
          )}
        </Fila>
        <Fila etiqueta="Detalle del Pedido" htmlFor="oc-detalle" ayuda="Una línea por material, como lo escribís siempre: “40 - bolsas de cemento”.">
          <AreaTexto id="oc-detalle" rows={6} maxLength={5000} value={detalle} onChange={(e) => setDetalle(e.target.value)} placeholder={"40 - bolsas de cemento\n10 - barras del 8\n3 rollos malla de seguridad"} />
          <div className="mt-2 flex flex-wrap gap-2">
            <Boton variante="secundario" tamano="chico" icono={<ListPlus />} disabled={!detalle.trim()} onClick={() => {
              const nuevos = pasarARenglones(detalle).map((r) => ({ descripcion: r.descripcion, cantidad: numTexto(r.cantidad), unidad: r.unidad, precio: "" }));
              setRenglones((x) => [...x.filter((r) => r.descripcion.trim()), ...nuevos]);
              aviso({ mensaje: `${nuevos.length} ${nuevos.length === 1 ? "renglón" : "renglones"}. Revisalos abajo.` });
            }}>Pasar a renglones</Boton>
            {planillas.map((a) => <Boton key={a.id} variante="secundario" tamano="chico" icono={<FileSpreadsheet />} onClick={() => leerPlanilla(a)}>Importar de {a.nombre.length > 22 ? "la planilla" : a.nombre}</Boton>)}
            {renglones.length === 0 && <Boton variante="fantasma" tamano="chico" icono={<Plus />} onClick={() => setRenglones([vacio])}>Agregar renglones a mano</Boton>}
          </div>
          {renglones.length > 0 && (
            <div className="mt-3 overflow-x-auto rounded-md border border-linea">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-linea text-left text-[11px] tracking-[0.06em] text-suave uppercase">
                    <th className="w-24 px-2 py-2 text-right font-medium">Cantidad</th><th className="w-28 px-2 py-2 font-medium">Unidad</th><th className="px-2 py-2 font-medium">Material</th><th className="w-32 px-2 py-2 text-right font-medium">Precio unit.</th><th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {renglones.map((r, i) => (
                    <tr key={i} className="border-b border-linea last:border-0">
                      <td className="px-1 py-1"><Entrada aria-label={`Cantidad ${i + 1}`} inputMode="decimal" className="text-right" value={r.cantidad} onChange={(e) => cambiar(i, { cantidad: e.target.value.replace(/[^\d.,]/g, "") })} /></td>
                      <td className="px-1 py-1">
                        <Selector aria-label={`Unidad ${i + 1}`} value={r.unidad} onChange={(e) => cambiar(i, { unidad: e.target.value })}>
                          {[...new Set([r.unidad, ...UNIDADES])].map((u) => <option key={u} value={u}>{u}</option>)}
                        </Selector>
                      </td>
                      <td className="px-1 py-1"><Entrada aria-label={`Material ${i + 1}`} value={r.descripcion} maxLength={200} onChange={(e) => cambiar(i, { descripcion: e.target.value })} /></td>
                      <td className="px-1 py-1"><Entrada aria-label={`Precio ${i + 1}`} inputMode="decimal" className="text-right" value={r.precio} onChange={(e) => cambiar(i, { precio: e.target.value.replace(/[^\d.,]/g, "") })} placeholder="Opcional" /></td>
                      <td className="px-1"><button type="button" aria-label={`Borrar renglón ${i + 1}`} onClick={() => setRenglones((x) => x.filter((_, j) => j !== i))} className="grid size-8 place-items-center rounded text-suave hover:text-critico"><X className="size-4" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-between gap-2 border-t border-linea px-2 py-1">
                <Boton variante="fantasma" tamano="chico" icono={<Plus />} onClick={() => setRenglones((x) => [...x, vacio])}>Agregar renglón</Boton>
                {sumaRenglones != null && <button type="button" className="text-[12px] font-medium text-suave underline hover:text-tinta" onClick={() => setImporte(numTexto(Math.round(sumaRenglones * 100) / 100))}>Usar la suma como importe ({numTexto(Math.round(sumaRenglones * 100) / 100)})</button>}
              </div>
            </div>
          )}
        </Fila>
        <Fila etiqueta="Proveedor Sugerido" htmlFor="oc-sug" ayuda="El que propone el que pidió, aunque no esté cargado."><Entrada id="oc-sug" value={sugerido} onChange={(e) => setSugerido(e.target.value)} maxLength={200} placeholder="Ej.: Fenomix" /></Fila>
        <Fila etiqueta="Proveedor Final" ayuda="Se puede dejar para después: hace falta para habilitar el retiro.">
          <SelectorProveedorSucursal etiquetaOculta proveedores={d.proveedores} valor={prov} onCambio={(v) => setProv(v)} destino={destino} />
        </Fila>
        <Fila etiqueta="Presupuesto N°" htmlFor="oc-pres"><Entrada id="oc-pres" value={presupuesto} onChange={(e) => setPresupuesto(e.target.value)} maxLength={60} /></Fila>
        <Fila etiqueta="Importe" htmlFor="oc-importe">
          <div className="flex flex-wrap items-center gap-3">
            <Entrada id="oc-importe" inputMode="decimal" className="w-48 text-right" value={importe} onChange={(e) => setImporte(e.target.value.replace(/[^\d.,]/g, ""))} placeholder="723.839,42" disabled={aConfirmar && !importe} />
            <div className="w-36"><Opciones nombre="Moneda" columnas={2} valor={moneda} onElegir={(v) => setMoneda(v as "ARS" | "USD")} opciones={[{ valor: "ARS", titulo: "$" }, { valor: "USD", titulo: "US$" }]} /></div>
            <label className="flex min-h-11 items-center gap-2 text-sm lg:min-h-9"><input type="checkbox" checked={aConfirmar} onChange={(e) => setAConfirmar(e.target.checked)} className="size-5 accent-[#111827] lg:size-4" /> A confirmar</label>
          </div>
          {moneda === "USD" && <p className="mt-1 text-[12px] text-suave">Se guarda la cotización del dólar oficial del día.</p>}
        </Fila>
        <Fila etiqueta="Forma de Pago"><Opciones nombre="Forma de pago" columnas={2} valor={forma} onElegir={(v) => setForma(v as FormaPago)} opciones={opcionesForma} /></Fila>
        <Fila etiqueta="Condición de Pago">
          <Opciones nombre="Condición de pago" columnas={2} valor={condicion} onElegir={(v) => setCondicion(v as CondicionPago)} opciones={opcionesCondicion} />
          {condicion && <Entrada aria-label="Detalle de la condición" className="mt-2" value={condicionTexto} onChange={(e) => setCondicionTexto(e.target.value)} maxLength={200} placeholder={condicion === "OTRA" ? "¿Cuál? (obligatorio)" : "Detalle (opcional): 50 % anticipo, saldo contra entrega"} />}
        </Fila>
        <Fila etiqueta="Fecha de entrega programada" htmlFor="oc-entrega"><Fecha id="oc-entrega" value={entrega} onChange={(e) => setEntrega(e.target.value)} /></Fila>
      </Seccion>

      <Seccion titulo="1.1 Observaciones de la Orden de Pedido">
        <div className="py-3">
          <AreaTexto aria-label="Observaciones de la Orden de Pedido" rows={3} maxLength={3000} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Van en el PDF. Ej.: descargar por Darwin, el portón de Thames está cerrado." />
        </div>
      </Seccion>

      <Seccion titulo="Adjuntos" detalle="presupuesto del proveedor, lista de materiales">
        <div className="flex flex-col gap-2 py-3">
          <ListaAdjuntos adjuntos={d.adjuntosOC} />
          <SubirAdjuntos entidadTipo="ORDEN_COMPRA" compacto etiqueta="Adjuntar presupuesto o lista" onCambio={(ids, s) => { setAdjuntos(ids); setSubiendo(s); }} />
          <label htmlFor="oc-notas" className="mt-2 text-[13px] font-medium text-suave">Notas internas (no van en el PDF)</label>
          <AreaTexto id="oc-notas" rows={2} maxLength={3000} value={notas} onChange={(e) => setNotas(e.target.value)} />
        </div>
      </Seccion>

      <Seccion titulo="2. Autorización a la Orden de Pedido">
        <div className="py-3 text-sm">
          {!o || o.estado === "BORRADOR" ? <p className="text-suave">Todavía no se envió. Al tocar “Enviar a aprobación” le llega al dueño con todos los datos.</p>
            : o.estado === "APROBADA" ? <p className="text-ok">Autorizada por {o.aprobadaPor}{o.aprobadaEn ? ` el ${new Date(o.aprobadaEn).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}` : ""}.</p>
            : o.estado === "ESPERANDO_APROBACION" ? <p className="text-aviso-texto">Esperando la autorización del dueño.</p>
            : <p className="text-critico">{o.estado === "RECHAZADA" ? `Rechazada: ${o.motivoRechazo ?? ""}` : `Anulada: ${o.motivoAnulacion ?? ""}`}</p>}
          {o?.estado === "APROBADA" && <p className="mt-1 text-suave">Si cambiás proveedor final, importe, materiales, forma o condición de pago, vuelve a aprobación como v{o.versionAprobacion + 1}.</p>}
        </div>
      </Seccion>

      <Seccion titulo="3. Facturación" plegable abierta={!!(o?.facturaNumero || o?.empresaFacturarId)} detalle="opcional">
        <Fila etiqueta="Empresa para facturar" htmlFor="oc-facemp" ayuda={razonFacturar ? `CUIT ${razonFacturar.cuit}` : undefined}>
          <Selector id="oc-facemp" value={facEmpresa} onChange={(e) => setFacEmpresa(e.target.value)}>
            <option value="">—</option>
            {d.razones.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </Selector>
        </Fila>
        <Fila etiqueta="Factura N°" htmlFor="oc-facnum"><Entrada id="oc-facnum" value={facNumero} onChange={(e) => setFacNumero(e.target.value)} maxLength={60} /></Fila>
        <Fila etiqueta="Importe" htmlFor="oc-facimp"><Entrada id="oc-facimp" inputMode="decimal" className="w-48 text-right" value={facImporte} onChange={(e) => setFacImporte(e.target.value.replace(/[^\d.,]/g, ""))} /></Fila>
        <Fila etiqueta="Fecha" htmlFor="oc-facfec"><Fecha id="oc-facfec" value={facFecha} onChange={(e) => setFacFecha(e.target.value)} /></Fila>
        <Fila etiqueta="Forma de Pago"><Opciones nombre="Forma de pago de la factura" columnas={2} valor={facForma || undefined} onElegir={(v) => setFacForma(v as FormaPago)} opciones={opcionesForma} /></Fila>
        <Fila etiqueta="Condición de Pago"><Opciones nombre="Condición de pago de la factura" columnas={2} valor={facCondicion || undefined} onElegir={(v) => setFacCondicion(v as CondicionPago)} opciones={opcionesCondicion} /></Fila>
        <Fila etiqueta="Factura (archivo)">
          {facAdjunto && d.adjuntosOC.some((a) => a.id === facAdjunto) ? <ListaAdjuntos adjuntos={d.adjuntosOC.filter((a) => a.id === facAdjunto)} /> : null}
          <SubirAdjuntos entidadTipo="ORDEN_COMPRA" compacto etiqueta="Adjuntar la factura" onCambio={(ids, s) => { setFacAdjunto(ids[0] ?? o?.facturaAdjuntoId ?? null); setAdjFactura(ids); setSubiendo(s); }} />
        </Fila>
      </Seccion>

      <Seccion titulo="4. Orden de Pago" plegable abierta={!!(o?.fechaPago || o?.ordenPagoAutorizadaEn)} detalle="opcional">
        <Fila etiqueta="Autorización a la Orden de Pago">
          <p className="pt-2 text-sm">{o?.ordenPagoAutorizadaEn ? `Autorizó ${o.ordenPagoAutorizadaPor} el ${new Date(o.ordenPagoAutorizadaEn).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}` : <span className="text-suave">La autoriza el dueño desde el tablero (botón “Autorizar la orden de pago”).</span>}</p>
        </Fila>
        <Fila etiqueta="Fecha de Pago" htmlFor="oc-fpago"><Fecha id="oc-fpago" value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} /></Fila>
        <Fila etiqueta="Importe pagado" htmlFor="oc-ipago"><Entrada id="oc-ipago" inputMode="decimal" className="w-48 text-right" value={pagoImporte} onChange={(e) => setPagoImporte(e.target.value.replace(/[^\d.,]/g, ""))} /></Fila>
        <Fila etiqueta="Observaciones" htmlFor="oc-opobs"><AreaTexto id="oc-opobs" rows={2} maxLength={1000} value={pagoObs} onChange={(e) => setPagoObs(e.target.value)} /></Fila>
      </Seccion>

      <MensajeError>{error}</MensajeError>
      {/* Botones fijos abajo */}
      <div className="sticky bottom-[calc(56px+env(safe-area-inset-bottom))] z-10 -mx-4 flex flex-col gap-2 border-t border-linea bg-fondo/95 px-4 py-3 backdrop-blur sm:flex-row lg:bottom-0 lg:mx-0 lg:rounded-[var(--radius-caja)] lg:border lg:bg-papel/95 lg:px-3">
        <Boton variante="secundario" icono={<Save />} cargando={enviando === "guardar"} disabled={!!enviando} onClick={() => guardar(false)}>{enviada ? "Guardar cambios" : "Guardar"}</Boton>
        <Boton variante="secundario" icono={<Eye />} cargando={enviando === "vista"} disabled={!!enviando} onClick={verPDF}>Vista previa PDF</Boton>
        {!enviada && <Boton icono={<Send />} cargando={enviando === "enviar"} disabled={!!enviando || subiendo} onClick={() => guardar(true)} className="sm:ml-auto">Enviar a aprobación</Boton>}
      </div>

      <Hoja abierta={!!vista} onCerrar={() => setVista(null)} titulo="Vista previa (borrador, sin número)" ancho>
        {vista && <iframe src={vista} title="Vista previa de la orden" className="h-[78dvh] w-full rounded-md border border-linea bg-fondo" />}
      </Hoja>

      <Hoja abierta={!!importar} onCerrar={() => setImportar(null)} titulo={importar ? `Importar ${importar.nombre}` : ""}>
        {importar && (
          importar.filas == null ? <p className="text-sm text-suave">Leyendo la planilla…</p> : importar.motivo ? (
            <div className="flex flex-col gap-3"><MensajeError>{importar.motivo}</MensajeError><Boton variante="secundario" onClick={() => setImportar(null)}>Cargar a mano</Boton></div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-suave">{importar.filas.length} renglones. Se agregan a la tabla y los podés corregir.</p>
              <ul className="divide-y divide-linea rounded-md border border-linea bg-papel text-sm">
                {importar.filas.map((f, i) => <li key={i} className="flex justify-between gap-3 px-3 py-2"><span>{f.descripcion}</span><span className="shrink-0 text-suave tabular-nums">{f.cantidad != null ? f.cantidad.toLocaleString("es-AR") : "—"} {f.unidad}</span></li>)}
              </ul>
              <Boton onClick={() => {
                const nuevos = importar.filas!.map((f) => ({ descripcion: f.descripcion, cantidad: f.cantidad != null ? numTexto(f.cantidad) : "", unidad: f.unidad, precio: "" }));
                setRenglones((x) => [...x.filter((r) => r.descripcion.trim()), ...nuevos]);
                setImportar(null);
                aviso({ mensaje: `${nuevos.length} renglones importados.` });
              }}>Agregar a la orden</Boton>
            </div>
          )
        )}
      </Hoja>
    </div>
  );
}
