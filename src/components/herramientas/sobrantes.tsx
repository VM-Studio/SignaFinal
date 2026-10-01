"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Hoja } from "@/components/ui/hoja";
import { Opciones } from "@/components/ui/opciones";
import { Campo, Entrada, MensajeError, Selector } from "@/components/ui/campos";
import { useAviso } from "@/components/ui/avisos";
import { agregarSobrante, deshacerUsoSobrante, usarSobrante } from "@/lib/herramientas/acciones";
import { cuando } from "@/lib/formato";

type Sobrante = { id: string; descripcion: string; categoria: "ELECTRICO" | "SANITARIO" | "OTRO"; cantidad: number; unidad: string; fecha: Date; obraOrigen: { nombre: string } | null };
const CAT = { ELECTRICO: "Eléctrico", SANITARIO: "Sanitario", OTRO: "Otro" } as const;
const num = (n: number) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n);

/** Lista simple de lo que quedó en el depósito: alta y baja rápida, sin stock complejo. */
export function Sobrantes({ lista, obras, editar }: { lista: Sobrante[]; obras: { id: string; nombre: string }[]; editar: boolean }) {
  const [alta, setAlta] = useState(false);
  const [usando, setUsando] = useState<Sobrante | null>(null);
  return (
    <div>
      {editar && <div className="mb-3"><Boton icono={<Plus className="size-5" />} onClick={() => setAlta(true)}>Agregar sobrante</Boton></div>}
      {(["ELECTRICO", "SANITARIO", "OTRO"] as const).map((c) => {
        const items = lista.filter((s) => s.categoria === c);
        if (!items.length) return null;
        return (
          <section key={c} className="mb-5">
            <h2 className="mb-2 text-sm font-bold tracking-wider text-suave uppercase">{CAT[c]}</h2>
            <ul className="divide-y divide-linea overflow-hidden rounded-[var(--radius-caja)] border border-linea bg-papel">
              {items.map((s) => (
                <li key={s.id} className="flex min-h-16 items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{s.descripcion}</p>
                    <p className="text-sm text-suave">{s.obraOrigen ? `Sobró de Obra ${s.obraOrigen.nombre} · ` : ""}{cuando(s.fecha)}</p>
                  </div>
                  <p className="text-lg font-bold tabular-nums">{num(s.cantidad)} <span className="text-sm font-medium text-suave">{s.unidad}</span></p>
                  {editar && <button onClick={() => setUsando(s)} aria-label={`Usar ${s.descripcion}`} className="grid size-11 place-items-center rounded-md border-2 border-negro"><Minus className="size-5" /></button>}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {!lista.length && <p className="rounded-[var(--radius-caja)] border border-dashed border-linea-fuerte bg-papel px-6 py-10 text-center text-suave">No quedó nada en el depósito.</p>}
      <Hoja abierta={alta} onCerrar={() => setAlta(false)} titulo="Agregar sobrante"><Alta obras={obras} cerrar={() => setAlta(false)} /></Hoja>
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
      <Opciones nombre="Tipo" columnas={3} valor={d.categoria} onElegir={(categoria) => setD({ ...d, categoria })} opciones={[{ valor: "ELECTRICO", titulo: "Eléctrico" }, { valor: "SANITARIO", titulo: "Sanitario" }, { valor: "OTRO", titulo: "Otro" }]} />
      <Campo etiqueta="¿Qué es?" htmlFor="so-desc"><Entrada id="so-desc" value={d.descripcion} onChange={(e) => setD({ ...d, descripcion: e.target.value })} maxLength={120} placeholder="Ej.: cable 2,5 mm" /></Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Cantidad" htmlFor="so-cant"><Entrada id="so-cant" inputMode="decimal" value={d.cantidad} onChange={(e) => setD({ ...d, cantidad: e.target.value.replace(",", ".") })} /></Campo>
        <Campo etiqueta="Unidad" htmlFor="so-u">
          <Selector id="so-u" value={d.unidad} onChange={(e) => setD({ ...d, unidad: e.target.value })}>
            {["u", "m", "barras", "rollos", "cajas", "kg"].map((x) => <option key={x} value={x}>{x}</option>)}
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
      <Boton ancho tamano="grande" cargando={enviando} onClick={async () => {
        setEnviando(true);
        const r = await agregarSobrante({ ...d, categoria: d.categoria as "OTRO" });
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
      <Boton ancho tamano="grande" cargando={enviando} disabled={!todo && !cant} onClick={async () => {
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
