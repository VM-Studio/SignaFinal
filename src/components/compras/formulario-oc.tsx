"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Eye, FileSpreadsheet, Plus, Save, Send, X } from "lucide-react";
import type { MetodoPago } from "@prisma/client";
import { Boton } from "@/components/ui/boton";
import { Hoja } from "@/components/ui/hoja";
import { AreaTexto, Campo, Entrada, Fecha, MensajeError, Selector } from "@/components/ui/campos";
import { Opciones } from "@/components/ui/opciones";
import { useAviso } from "@/components/ui/avisos";
import { SubirAdjuntos } from "@/components/adjuntos/subir";
import { ListaAdjuntos } from "@/components/adjuntos/lista";
import { SelectorProveedorSucursal, type ValorProveedor } from "@/components/proveedores/selector";
import { guardarOC, importarPlanilla } from "@/lib/compras/acciones";
import { calcularTotales, METODO_PAGO } from "@/lib/compras/estados";
import type { FormularioOCDatos } from "@/lib/compras/consultas";
import type { RenglonImportado } from "@/lib/compras/importar";
import { diaISO } from "@/lib/formato";

type Renglon = { descripcion: string; cantidad: string; unidad: string; precio: string };
const UNIDADES = ["u", "bolsas", "m", "m²", "m³", "kg", "barras", "rollos", "cajas", "litros", "pallets", "tn"];
const vacio: Renglon = { descripcion: "", cantidad: "", unidad: "u", precio: "" };
/** "11.500,50" → 11500.5 */
const aNum = (s: string) => {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) ? n : null;
};
const fmt = (n: number, moneda: "ARS" | "USD") => `${moneda === "USD" ? "US$" : "$"} ${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const PLANILLA = /\.(xlsx|csv|xls)$/i;

/**
 * ORDEN DE COMPRA: el formulario sigue el orden de la plantilla impresa (encabezado, proveedor y
 * sucursal, materiales, pago, totales, adjuntos, observaciones). "Guardar borrador" se retoma;
 * "Vista previa del PDF" lo genera sin número y con marca BORRADOR; "Enviar a aprobación" asigna el
 * número OC-AAAA-NNNN y le llega al dueño.
 */
export function FormularioOC({ d }: { d: FormularioOCDatos }) {
  const router = useRouter();
  const aviso = useAviso();
  const b = d.borrador;
  const [ocId, setOcId] = useState<string | null>(b?.id ?? null);
  const [fecha, setFecha] = useState(b?.fecha ?? diaISO());
  const [fechaNecesaria, setFechaNecesaria] = useState(b?.fechaNecesaria ?? d.pedido.paraCuando);
  const [prov, setProv] = useState<ValorProveedor>({ proveedorId: b?.proveedorId ?? null, sucursalId: b?.sucursalId ?? null });
  const inicial: Renglon[] = b?.renglones.length
    ? b.renglones.map((r) => ({ descripcion: r.descripcion, cantidad: String(r.cantidad).replace(".", ","), unidad: r.unidad, precio: r.precioUnitario != null ? String(r.precioUnitario).replace(".", ",") : "" }))
    : d.pedido.renglones.length
      ? d.pedido.renglones.map((r) => ({ descripcion: r.descripcion, cantidad: r.cantidad != null ? String(r.cantidad).replace(".", ",") : "", unidad: r.unidad ?? "u", precio: "" }))
      : [vacio]; // vino con adjunto: la tabla arranca vacía, con el archivo al lado para transcribir
  const [renglones, setRenglones] = useState<Renglon[]>(inicial);
  const [metodo, setMetodo] = useState<MetodoPago | undefined>(b?.metodoPago ?? undefined);
  const [moneda, setMoneda] = useState<"ARS" | "USD">(b?.moneda ?? "ARS");
  const [condiciones, setCondiciones] = useState(b?.condiciones ?? "");
  const [iva, setIva] = useState<string>(b ? (b.ivaPorcentaje == null ? "" : String(b.ivaPorcentaje)) : "21");
  const [conIva, setConIva] = useState(b ? b.ivaPorcentaje != null : true);
  const [observaciones, setObservaciones] = useState(b?.observaciones ?? "");
  const [notas, setNotas] = useState(b?.notasInternas ?? d.pedido.notasCompras ?? "");
  const [adjuntos, setAdjuntos] = useState<string[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState<"borrador" | "enviar" | "vista" | null>(null);
  const [vista, setVista] = useState<string | null>(null);
  const [importar, setImportar] = useState<{ nombre: string; filas: RenglonImportado[] | null; motivo?: string } | null>(null);

  const planillas = d.adjuntosPedido.filter((a) => PLANILLA.test(a.nombre));
  const ivaPorcentaje = conIva ? aNum(iva) ?? 0 : null;
  const tot = useMemo(() => calcularTotales(renglones.filter((r) => r.descripcion.trim()).map((r) => ({ cantidad: aNum(r.cantidad) ?? 0, precioUnitario: aNum(r.precio) })), ivaPorcentaje), [renglones, ivaPorcentaje]);
  const cambiar = (i: number, c: Partial<Renglon>) => setRenglones((x) => x.map((r, j) => (j === i ? { ...r, ...c } : r)));
  const mover = (i: number, a: number) => setRenglones((x) => { const y = [...x]; [y[i], y[a]] = [y[a], y[i]]; return y; });

  const datos = () => ({
    id: ocId ?? undefined, pedidoMaterialId: d.pedido.id, fecha, fechaNecesaria, proveedorId: prov.proveedorId ?? undefined, sucursalId: prov.sucursalId ?? undefined,
    renglones: renglones.map((r) => ({ descripcion: r.descripcion, cantidad: r.cantidad, unidad: r.unidad, precioUnitario: r.precio })),
    metodoPago: metodo, moneda, condiciones, ivaPorcentaje, observaciones, notasInternas: notas, adjuntos,
  });

  async function guardar(enviar: boolean) {
    setError(undefined);
    if (subiendo) return setError("Esperá a que terminen de subir los archivos.");
    if (enviar && !prov.sucursalId) return setError(prov.proveedorId ? "Elegí la sucursal del proveedor." : "Elegí el proveedor.");
    if (enviar && !metodo) return setError("Elegí el método de pago.");
    setEnviando(enviar ? "enviar" : "borrador");
    const r = await guardarOC(datos(), enviar);
    setEnviando(null);
    if (!r.ok) return setError(r.error);
    setOcId(r.datos.id);
    setAdjuntos([]);
    if (enviar) {
      aviso({ mensaje: `${r.datos.numero} enviada a aprobación. Le llegó al dueño.` });
      router.push(`/compras/${d.pedido.id}`);
    } else {
      aviso({ mensaje: "Borrador guardado. Lo podés retomar cuando quieras." });
      router.refresh();
    }
  }

  async function verPDF() {
    setEnviando("vista");
    setError(undefined);
    try {
      const r = await fetch("/api/oc/vista-previa", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedidoMaterialId: d.pedido.id, fecha, fechaNecesaria, sucursalId: prov.sucursalId, metodoPago: metodo ?? null, moneda, condiciones, observaciones, ivaPorcentaje, renglones: renglones.map((x) => ({ descripcion: x.descripcion, cantidad: x.cantidad, unidad: x.unidad, precioUnitario: x.precio })) }),
      });
      if (!r.ok) throw new Error();
      if (vista) URL.revokeObjectURL(vista);
      setVista(URL.createObjectURL(await r.blob()));
    } catch {
      setError("No se pudo generar la vista previa. Probá de nuevo.");
    } finally {
      setEnviando(null);
    }
  }

  async function leerPlanilla(a: { id: string; nombre: string }) {
    setImportar({ nombre: a.nombre, filas: null });
    const r = await importarPlanilla(a.id);
    if (!r.ok) return setImportar({ nombre: a.nombre, filas: [], motivo: r.error });
    setImportar(r.datos.ok ? { nombre: a.nombre, filas: r.datos.renglones } : { nombre: a.nombre, filas: [], motivo: r.datos.motivo });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ── Encabezado ── */}
      <section className="grid grid-cols-2 gap-3 rounded-[var(--radius-caja)] border border-linea bg-papel p-4 sm:grid-cols-4">
        <div className="col-span-2 sm:col-span-1">
          <p className="etiqueta">Número</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-suave">Se asigna al enviar</p>
        </div>
        <div className="col-span-2 sm:col-span-1"><Campo etiqueta="Fecha de emisión" htmlFor="oc-fecha"><Fecha id="oc-fecha" value={fecha} onChange={(e) => setFecha(e.target.value)} /></Campo></div>
        <div><p className="etiqueta">Obra</p><p className="mt-1 text-sm font-medium">Obra {d.pedido.obra}{d.pedido.sede ? ` · ${d.pedido.sede}` : ""}</p></div>
        <div><p className="etiqueta">Solicitante</p><p className="mt-1 text-sm font-medium">{d.pedido.solicitante}</p></div>
      </section>

      <Campo etiqueta="Fecha necesaria / vencimiento" htmlFor="oc-nec"><Fecha id="oc-nec" value={fechaNecesaria} onChange={(e) => setFechaNecesaria(e.target.value)} /></Campo>

      {/* ── Proveedor y sucursal ── */}
      <SelectorProveedorSucursal proveedores={d.proveedores} valor={prov} onCambio={(v) => setProv(v)} destino={d.pedido.destino} />

      {/* ── Materiales ── */}
      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="etiqueta">Materiales</p>
          {planillas.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {planillas.map((a) => (
                <Boton key={a.id} variante="secundario" tamano="chico" icono={<FileSpreadsheet />} onClick={() => leerPlanilla(a)}>Importar desde {a.nombre.length > 24 ? "Excel/CSV" : a.nombre}</Boton>
              ))}
            </div>
          )}
        </div>
        <div className="overflow-x-auto rounded-[var(--radius-caja)] border border-linea bg-papel">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-linea text-left text-[11px] tracking-[0.06em] text-suave uppercase">
                <th className="w-8 px-2 py-2" /><th className="px-2 py-2 font-medium">Descripción</th><th className="w-24 px-2 py-2 text-right font-medium">Cantidad</th>
                <th className="w-28 px-2 py-2 font-medium">Unidad</th><th className="w-32 px-2 py-2 text-right font-medium">Precio unit.</th><th className="w-32 px-2 py-2 text-right font-medium">Subtotal</th><th className="w-24" />
              </tr>
            </thead>
            <tbody>
              {renglones.map((r, i) => {
                const c = aNum(r.cantidad);
                const p = aNum(r.precio);
                return (
                  <tr key={i} className="border-b border-linea last:border-0">
                    <td className="px-2 text-center text-[12px] text-suave tabular-nums">{i + 1}</td>
                    <td className="px-1 py-1"><Entrada aria-label={`Descripción ${i + 1}`} value={r.descripcion} maxLength={200} onChange={(e) => cambiar(i, { descripcion: e.target.value })} placeholder="Ej.: Cemento Portland x 50 kg" /></td>
                    <td className="px-1 py-1"><Entrada aria-label={`Cantidad ${i + 1}`} inputMode="decimal" className="text-right" value={r.cantidad} onChange={(e) => cambiar(i, { cantidad: e.target.value.replace(/[^\d.,]/g, "") })} /></td>
                    <td className="px-1 py-1">
                      <Selector aria-label={`Unidad ${i + 1}`} value={r.unidad} onChange={(e) => cambiar(i, { unidad: e.target.value })}>
                        {[...new Set([r.unidad, ...UNIDADES])].map((u) => <option key={u} value={u}>{u}</option>)}
                      </Selector>
                    </td>
                    <td className="px-1 py-1"><Entrada aria-label={`Precio ${i + 1}`} inputMode="decimal" className="text-right" value={r.precio} onChange={(e) => cambiar(i, { precio: e.target.value.replace(/[^\d.,]/g, "") })} placeholder="Opcional" /></td>
                    <td className="px-2 text-right tabular-nums">{c != null && p != null ? fmt(c * p, moneda) : "—"}</td>
                    <td className="px-1">
                      <div className="flex justify-end">
                        <button type="button" aria-label="Subir" disabled={i === 0} onClick={() => mover(i, i - 1)} className="grid size-8 place-items-center rounded text-suave hover:text-tinta disabled:opacity-30"><ArrowUp className="size-4" /></button>
                        <button type="button" aria-label="Bajar" disabled={i === renglones.length - 1} onClick={() => mover(i, i + 1)} className="grid size-8 place-items-center rounded text-suave hover:text-tinta disabled:opacity-30"><ArrowDown className="size-4" /></button>
                        <button type="button" aria-label={`Borrar renglón ${i + 1}`} onClick={() => setRenglones((x) => (x.length === 1 ? [vacio] : x.filter((_, j) => j !== i)))} className="grid size-8 place-items-center rounded text-suave hover:text-critico"><X className="size-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Boton variante="fantasma" tamano="chico" icono={<Plus />} className="self-start" onClick={() => setRenglones((x) => [...x, vacio])}>Agregar renglón</Boton>
      </section>

      {/* ── Pago ── */}
      <section className="flex flex-col gap-3">
        <div>
          <p className="mb-2 text-[12px] font-medium text-suave">Método de pago (obligatorio)</p>
          <Opciones nombre="Método de pago" columnas={3} valor={metodo} onElegir={(v) => setMetodo(v as MetodoPago)} opciones={(Object.keys(METODO_PAGO) as MetodoPago[]).map((m) => ({ valor: m, titulo: METODO_PAGO[m] }))} />
        </div>
        <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
          <div>
            <p className="mb-2 text-[12px] font-medium text-suave">Moneda</p>
            <Opciones nombre="Moneda" columnas={2} valor={moneda} onElegir={(v) => setMoneda(v as "ARS" | "USD")} opciones={[{ valor: "ARS", titulo: "ARS" }, { valor: "USD", titulo: "USD" }]} />
          </div>
          <Campo etiqueta="Condiciones" htmlFor="oc-cond"><Entrada id="oc-cond" value={condiciones} onChange={(e) => setCondiciones(e.target.value)} maxLength={300} placeholder="50% anticipo, saldo contra entrega" /></Campo>
        </div>
      </section>

      {/* ── Totales (solo si hay precios) ── */}
      {tot.conPrecios ? (
        <section className="ml-auto flex w-full max-w-sm flex-col gap-1 rounded-[var(--radius-caja)] border border-linea bg-papel p-4 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{fmt(tot.subtotal, moneda)}</span></div>
          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={conIva} onChange={(e) => setConIva(e.target.checked)} className="size-4 accent-[#111827]" /> IVA
              {conIva && <Entrada aria-label="Porcentaje de IVA" inputMode="decimal" value={iva} onChange={(e) => setIva(e.target.value.replace(/[^\d.,]/g, ""))} className="!min-h-8 w-16 text-right" />}
              {conIva ? "%" : <span className="text-suave">sin IVA</span>}
            </label>
            <span className="tabular-nums">{fmt(tot.iva, moneda)}</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-linea pt-2 font-semibold"><span>Total</span><span className="tabular-nums">{fmt(tot.total, moneda)}</span></div>
        </section>
      ) : (
        <p className="text-sm text-suave">Sin precios cargados: el PDF va a decir “Según presupuesto adjunto”.</p>
      )}

      {/* ── Adjuntos de la OC ── */}
      <section className="flex flex-col gap-2">
        <p className="etiqueta">Adjuntos de la OC (presupuesto del proveedor y lo que haga falta)</p>
        <ListaAdjuntos adjuntos={d.adjuntosOC} />
        <SubirAdjuntos entidadTipo="ORDEN_COMPRA" compacto etiqueta="Adjuntar presupuesto" onCambio={(ids, s) => { setAdjuntos(ids); setSubiendo(s); }} />
      </section>

      <Campo etiqueta="Observaciones de la OC (van en el PDF)" htmlFor="oc-obs"><AreaTexto id="oc-obs" rows={3} maxLength={1500} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Ej.: entregar por la calle Darwin" /></Campo>
      <Campo etiqueta="Notas internas (no van en el PDF)" htmlFor="oc-notas"><AreaTexto id="oc-notas" rows={2} maxLength={2000} value={notas} onChange={(e) => setNotas(e.target.value)} /></Campo>

      <MensajeError>{error}</MensajeError>
      <div className="sticky bottom-[calc(56px+env(safe-area-inset-bottom))] z-10 -mx-4 flex flex-col gap-2 border-t border-linea bg-fondo px-4 py-3 sm:flex-row lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0">
        <Boton variante="secundario" icono={<Save />} cargando={enviando === "borrador"} disabled={!!enviando} onClick={() => guardar(false)}>Guardar borrador</Boton>
        <Boton variante="secundario" icono={<Eye />} cargando={enviando === "vista"} disabled={!!enviando} onClick={verPDF}>Vista previa del PDF</Boton>
        <Boton icono={<Send />} cargando={enviando === "enviar"} disabled={!!enviando || subiendo} onClick={() => guardar(true)} className="sm:ml-auto">Enviar a aprobación</Boton>
      </div>

      <Hoja abierta={!!vista} onCerrar={() => setVista(null)} titulo="Vista previa (borrador, sin número)" ancho>
        {vista && <iframe src={vista} title="Vista previa de la orden de compra" className="h-[78dvh] w-full rounded-md border border-linea bg-fondo" />}
      </Hoja>

      <Hoja abierta={!!importar} onCerrar={() => setImportar(null)} titulo={importar ? `Importar ${importar.nombre}` : ""}>
        {importar && (
          importar.filas == null ? <p className="text-sm text-suave">Leyendo la planilla…</p> : importar.motivo ? (
            <div className="flex flex-col gap-3">
              <MensajeError>{importar.motivo}</MensajeError>
              <Boton variante="secundario" onClick={() => setImportar(null)}>Cargar a mano</Boton>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-suave">{importar.filas.length} renglones. Revisalos: se agregan a la tabla y los podés corregir.</p>
              <ul className="divide-y divide-linea rounded-md border border-linea bg-papel text-sm">
                {importar.filas.map((f, i) => (
                  <li key={i} className="flex justify-between gap-3 px-3 py-2"><span>{f.descripcion}</span><span className="shrink-0 text-suave tabular-nums">{f.cantidad != null ? f.cantidad.toLocaleString("es-AR") : "—"} {f.unidad}</span></li>
                ))}
              </ul>
              <Boton onClick={() => {
                const nuevos = importar.filas!.map((f) => ({ descripcion: f.descripcion, cantidad: f.cantidad != null ? String(f.cantidad).replace(".", ",") : "", unidad: f.unidad, precio: "" }));
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
