"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Boxes, Minus, Plus } from "lucide-react";
import { Boton, claseBoton } from "@/components/ui/boton";
import { Vacio } from "@/components/ui/basicos";
import { Hoja } from "@/components/ui/hoja";
import { Opciones } from "@/components/ui/opciones";
import { Campo, Entrada, MensajeError, Selector } from "@/components/ui/campos";
import { useAviso } from "@/components/ui/avisos";
import { agregarSobrante, deshacerUsoSobrante, usarSobrante } from "@/lib/herramientas/acciones";
import { cuando } from "@/lib/formato";

type Sobrante = { id: string; descripcion: string; categoria: Categoria; cantidad: number; unidad: string; fecha: Date; obraOrigen: { nombre: string } | null };
type Categoria = "CONSTRUCCION" | "ELECTRICO" | "SANITARIO" | "OTRO";
const CAT: Record<Categoria, string> = { CONSTRUCCION: "Construcción", ELECTRICO: "Eléctrico", SANITARIO: "Sanitario", OTRO: "Otro" };
const ORDEN: Categoria[] = ["CONSTRUCCION", "ELECTRICO", "SANITARIO", "OTRO"];
const num = (n: number) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n);

/** Botón "Agregar sobrante" (va en el header de la pantalla) con su hoja. */
export function AgregarSobrante({ obras }: { obras: { id: string; nombre: string }[] }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <>
      <Boton icono={<Plus />} onClick={() => setAbierta(true)}>Agregar sobrante</Boton>
      <Hoja abierta={abierta} onCerrar={() => setAbierta(false)} titulo="Agregar sobrante"><Alta obras={obras} cerrar={() => setAbierta(false)} /></Hoja>
    </>
  );
}

/**
 * Materiales de construcción que sobraron de las obras y están en el depósito. Lista simple: alta y
 * "usar" (todo o una parte), sin stock complejo. Celular: filas por tipo. Escritorio: tabla.
 */
export function Sobrantes({ lista, editar }: { lista: Sobrante[]; editar: boolean }) {
  const [usando, setUsando] = useState<Sobrante | null>(null);
  const usar = (x: Sobrante) => (
    <button onClick={() => setUsando(x)} aria-label={`Usar ${x.descripcion}`} className={claseBoton("secundario", "chico")}><Minus /> Usar</button>
  );
  if (!lista.length) return <Vacio icono={<Boxes />} titulo="No hay sobrantes en el depósito">Cuando sobre material de una obra, cargalo con “Agregar sobrante”.</Vacio>;
  const ordenada = [...lista].sort((a, b) => ORDEN.indexOf(a.categoria) - ORDEN.indexOf(b.categoria));
  return (
    <div>
      {/* Celular: filas por tipo */}
      <div className="lg:hidden">
        {ORDEN.map((c) => {
          const items = lista.filter((x) => x.categoria === c);
          if (!items.length) return null;
          return (
            <section key={c} className="mb-4">
              <h2 className="etiqueta mb-2">{CAT[c]}</h2>
              <ul className="-mx-4 divide-y divide-linea border-y border-linea bg-papel">
                {items.map((x) => (
                  <li key={x.id} className="flex min-h-14 items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{x.descripcion}</p>
                      <p className="text-sm text-suave">{num(x.cantidad)} {x.unidad}{x.obraOrigen ? ` · sobró de Obra ${x.obraOrigen.nombre}` : ""} · {cuando(x.fecha)}</p>
                    </div>
                    {editar && usar(x)}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      {/* Escritorio: tabla */}
      <div className="hidden overflow-hidden rounded-[var(--radius-caja)] border border-linea bg-papel lg:block">
        <table className="tabla">
          <thead>
            <tr><th>Material</th><th>Tipo</th><th>Sobró de</th><th>Desde</th><th className="num">Cantidad</th>{editar && <th />}</tr>
          </thead>
          <tbody>
            {ordenada.map((x) => (
              <tr key={x.id}>
                <td className="font-medium">{x.descripcion}</td>
                <td className="text-suave">{CAT[x.categoria]}</td>
                <td>{x.obraOrigen ? `Obra ${x.obraOrigen.nombre}` : <span className="text-suave">—</span>}</td>
                <td className="text-suave">{cuando(x.fecha)}</td>
                <td className="num">{num(x.cantidad)} <span className="text-suave">{x.unidad}</span></td>
                {editar && <td className="w-px text-right">{usar(x)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Hoja abierta={!!usando} onCerrar={() => setUsando(null)} titulo={usando ? `Usar ${usando.descripcion}` : ""}>{usando && <Usar s={usando} cerrar={() => setUsando(null)} />}</Hoja>
    </div>
  );
}

function Alta({ obras, cerrar }: { obras: { id: string; nombre: string }[]; cerrar: () => void }) {
  const [d, setD] = useState({ descripcion: "", categoria: "", cantidad: "", unidad: "u", obraOrigenId: "" });
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const router = useRouter();
  const aviso = useAviso();
  return (
    <div className="flex flex-col gap-4">
      <Opciones nombre="Tipo" columnas={2} valor={d.categoria} onElegir={(categoria) => setD({ ...d, categoria })} opciones={ORDEN.map((c) => ({ valor: c, titulo: CAT[c] }))} />
      <Campo etiqueta="¿Qué es?" htmlFor="so-desc"><Entrada id="so-desc" value={d.descripcion} onChange={(e) => setD({ ...d, descripcion: e.target.value })} maxLength={120} placeholder="Ej.: cemento, ladrillos, hierro del 8, cable 2,5 mm" /></Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Cantidad" htmlFor="so-cant"><Entrada id="so-cant" inputMode="decimal" value={d.cantidad} onChange={(e) => setD({ ...d, cantidad: e.target.value.replace(",", ".") })} /></Campo>
        <Campo etiqueta="Unidad" htmlFor="so-u">
          <Selector id="so-u" value={d.unidad} onChange={(e) => setD({ ...d, unidad: e.target.value })}>
            {["u", "bolsas", "m", "m²", "m³", "barras", "rollos", "cajas", "kg", "pallets"].map((x) => <option key={x} value={x}>{x}</option>)}
          </Selector>
        </Campo>
      </div>
      <Campo etiqueta="Sobró de (opcional)" htmlFor="so-obra">
        <Selector id="so-obra" value={d.obraOrigenId} onChange={(e) => setD({ ...d, obraOrigenId: e.target.value })}>
          <option value="">—</option>
          {obras.map((o) => <option key={o.id} value={o.id}>Obra {o.nombre}</option>)}
        </Selector>
      </Campo>
      <MensajeError>{error}</MensajeError>
      <Boton ancho cargando={enviando} onClick={async () => {
        setEnviando(true);
        const r = await agregarSobrante({ ...d, categoria: d.categoria as Categoria });
        setEnviando(false);
        if (!r.ok) return setError(r.error);
        cerrar();
        aviso({ mensaje: "Sobrante agregado." });
        router.refresh();
      }}>Agregar</Boton>
    </div>
  );
}

function Usar({ s, cerrar }: { s: Sobrante; cerrar: () => void }) {
  const [todo, setTodo] = useState(true);
  const [cant, setCant] = useState("");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const router = useRouter();
  const aviso = useAviso();
  return (
    <div className="flex flex-col gap-4">
      <Opciones nombre="Cuánto" columnas={2} valor={todo ? "todo" : "parte"} onElegir={(v) => setTodo(v === "todo")} opciones={[{ valor: "todo", titulo: `Todo (${num(s.cantidad)} ${s.unidad})` }, { valor: "parte", titulo: "Una parte" }]} />
      {!todo && <Campo etiqueta={`¿Cuánto se usó? (${s.unidad})`} htmlFor="us-cant"><Entrada id="us-cant" inputMode="decimal" value={cant} onChange={(e) => setCant(e.target.value.replace(",", "."))} /></Campo>}
      <Campo etiqueta="¿Para qué? (opcional)" htmlFor="us-mot"><Entrada id="us-mot" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={120} placeholder="Ej.: se llevó a Obra Chubut" /></Campo>
      <MensajeError>{error}</MensajeError>
      <Boton ancho cargando={enviando} disabled={!todo && !cant} onClick={async () => {
        setEnviando(true);
        const r = await usarSobrante(s.id, todo ? null : Number(cant), motivo);
        setEnviando(false);
        if (!r.ok) return setError(r.error);
        cerrar();
        aviso({
          mensaje: r.datos.queda > 0 ? `Quedan ${num(r.datos.queda)} ${s.unidad}.` : `${s.descripcion}: dado de baja.`,
          deshacer: async () => { await deshacerUsoSobrante(s.id, s.cantidad); router.refresh(); },
        });
        router.refresh();
      }}>Confirmar</Boton>
    </div>
  );
}
