"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, PlusCircle } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Hoja } from "@/components/ui/hoja";
import { Campo, Entrada, MensajeError } from "@/components/ui/campos";
import { Opciones } from "@/components/ui/opciones";
import { SelectorDireccion } from "@/components/ui/selector-direccion";
import { useAviso } from "@/components/ui/avisos";
import { guardarUbicacion } from "@/lib/ubicaciones/acciones";

export type UbicacionEditable = { id?: string; nombre: string; tipo: "DEPOSITO" | "BASE_VEHICULOS"; etiqueta: "Galpón" | "Terreno" | "Base"; direccion: string; localidad: string; lat: number | null; lng: number | null; activa: boolean };
const NUEVA: UbicacionEditable = { nombre: "", tipo: "DEPOSITO", etiqueta: "Galpón", direccion: "", localidad: "", lat: null, lng: null, activa: true };

/** Alta rápida o edición de un depósito, terreno o base: nombre, cómo le dice la gente y dirección con mapa. */
export function BotonUbicacion({ inicial }: { inicial?: UbicacionEditable }) {
  const router = useRouter();
  const aviso = useAviso();
  const [abierta, setAbierta] = useState(false);
  const [u, setU] = useState<UbicacionEditable>(inicial ?? NUEVA);
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  async function guardar() {
    setError(undefined);
    if (u.lat == null) return setError("Confirmá la dirección: elegí una sugerencia o poné el pin en el mapa.");
    setEnviando(true);
    const r = await guardarUbicacion({ ...u, lat: u.lat, lng: u.lng ?? undefined });
    setEnviando(false);
    if (!r.ok) return setError(r.error);
    setAbierta(false);
    aviso({ mensaje: inicial ? "Guardado." : `${u.nombre} cargado.` });
    if (!inicial) setU(NUEVA);
    router.refresh();
  }
  return (
    <>
      <Boton variante={inicial ? "secundario" : "primario"} tamano={inicial ? "chico" : "normal"} icono={inicial ? <Pencil /> : <PlusCircle />} onClick={() => setAbierta(true)}>{inicial ? "Editar" : "Nuevo lugar"}</Boton>
      <Hoja abierta={abierta} onCerrar={() => setAbierta(false)} titulo={inicial ? inicial.nombre : "Nuevo depósito, terreno o base"}>
        {abierta && (
          <div className="flex flex-col gap-4">
            <Campo etiqueta="Nombre" htmlFor="u-nombre" ayuda="Ej.: “Terreno Humboldt 2417”."><Entrada id="u-nombre" value={u.nombre} onChange={(e) => setU({ ...u, nombre: e.target.value })} maxLength={80} autoFocus /></Campo>
            <div>
              <p className="mb-2 text-[12px] font-medium text-suave">Cómo le dice la gente (se usa en los textos del chofer: “Llegué al galpón”)</p>
              <Opciones nombre="Etiqueta" columnas={3} valor={u.etiqueta} onElegir={(v) => setU({ ...u, etiqueta: v as UbicacionEditable["etiqueta"], tipo: v === "Base" ? "BASE_VEHICULOS" : "DEPOSITO" })} opciones={[{ valor: "Galpón", titulo: "Galpón" }, { valor: "Terreno", titulo: "Terreno" }, { valor: "Base", titulo: "Base", detalle: "de camiones" }]} />
            </div>
            <SelectorDireccion valor={u} onCambio={(v) => setU((x) => ({ ...x, direccion: v.direccion, localidad: x.localidad || v.localidad, lat: v.lat, lng: v.lng }))} />
            <Campo etiqueta="Localidad" htmlFor="u-loc"><Entrada id="u-loc" value={u.localidad} onChange={(e) => setU({ ...u, localidad: e.target.value })} maxLength={80} /></Campo>
            {inicial && (
              <label className="flex min-h-12 items-center gap-3 text-sm lg:min-h-9">
                <input type="checkbox" checked={u.activa} onChange={(e) => setU({ ...u, activa: e.target.checked })} className="size-5 accent-[#111827]" /> Activo
              </label>
            )}
            <MensajeError>{error}</MensajeError>
            <Boton ancho cargando={enviando} disabled={!u.nombre.trim() || !u.direccion.trim() || !u.localidad.trim()} onClick={guardar}>{inicial ? "Guardar" : "Cargar"}</Boton>
          </div>
        )}
      </Hoja>
    </>
  );
}
