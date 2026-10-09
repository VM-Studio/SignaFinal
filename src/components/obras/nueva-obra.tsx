"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, PlusCircle } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Hoja } from "@/components/ui/hoja";
import { Campo, Entrada, MensajeError } from "@/components/ui/campos";
import { useAviso } from "@/components/ui/avisos";
import { crearObra } from "@/lib/obras/acciones";

/** "Nueva obra": nombre, dirección y localidad (las coordenadas se buscan solas) y quiénes son los responsables. */
export function NuevaObra({ responsables }: { responsables: { id: string; nombre: string }[] }) {
  const router = useRouter();
  const aviso = useAviso();
  const [abierta, setAbierta] = useState(false);
  const [nombre, setNombre] = useState("");
  const [direccion, setDireccion] = useState("");
  const [localidad, setLocalidad] = useState("");
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const alternar = (id: string) => setElegidos((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]));

  async function guardar() {
    setEnviando(true);
    setError(undefined);
    const r = await crearObra({ nombre, direccion, localidad, responsables: elegidos });
    setEnviando(false);
    if (!r.ok) return setError(r.error);
    setAbierta(false);
    setNombre(""); setDireccion(""); setLocalidad(""); setElegidos([]);
    aviso({ mensaje: `Obra ${nombre} cargada. Ubicada en: ${r.datos.encontrada.split(",").slice(0, 3).join(",")}.` });
    router.refresh();
  }

  return (
    <>
      <Boton icono={<PlusCircle />} onClick={() => setAbierta(true)}>Nueva obra</Boton>
      <Hoja abierta={abierta} onCerrar={() => setAbierta(false)} titulo="Nueva obra">
        <div className="flex flex-col gap-4">
          <Campo etiqueta="Nombre" htmlFor="o-nombre" ayuda="Como la llaman todos: “Darwin”, “Pinares II”."><Entrada id="o-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} autoFocus /></Campo>
          <Campo etiqueta="Dirección" htmlFor="o-dir"><Entrada id="o-dir" value={direccion} onChange={(e) => setDireccion(e.target.value)} maxLength={120} placeholder="Darwin 1154" /></Campo>
          <Campo etiqueta="Localidad" htmlFor="o-loc" ayuda="Con la dirección se ubica sola en el mapa."><Entrada id="o-loc" value={localidad} onChange={(e) => setLocalidad(e.target.value)} maxLength={80} placeholder="Villa Crespo, CABA" /></Campo>
          {responsables.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold">Responsables (el primero que marques es el principal)</p>
              <div className="grid grid-cols-2 gap-2">
                {responsables.map((r) => {
                  const si = elegidos.includes(r.id);
                  return (
                    <button key={r.id} type="button" role="checkbox" aria-checked={si} onClick={() => alternar(r.id)}
                      className={`flex min-h-12 lg:min-h-9 items-center gap-2 rounded-[var(--radius-caja)] border px-3 text-left font-semibold ${si ? "border-tinta bg-hover text-tinta" : "border-linea bg-papel"}`}>
                      {si && <Check className="size-4 shrink-0" />} {r.nombre}{si && elegidos[0] === r.id ? " · principal" : ""}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <MensajeError>{error}</MensajeError>
          <Boton ancho cargando={enviando} disabled={!nombre.trim() || !direccion.trim() || !localidad.trim()} onClick={guardar}>Cargar la obra</Boton>
        </div>
      </Hoja>
    </>
  );
}
