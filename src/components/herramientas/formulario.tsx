"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pasos } from "@/components/ui/pasos";
import { Opciones } from "@/components/ui/opciones";
import { Campo, Entrada, Selector } from "@/components/ui/campos";
import { useAviso } from "@/components/ui/avisos";
import { useHoja } from "@/components/ui/hoja";
import { CampoFoto } from "@/components/viajes/campo-foto";
import { guardarHerramienta } from "@/lib/herramientas/acciones";

export type HerramientaEditable = {
  id?: string; nombre: string; categoria: string; esMaquina: boolean; tipoControl: "UNITARIA" | "CANTIDAD"; marca: string; modelo: string;
  nroSerie: string; valorCompra: string; mantenimientoCadaDias: string; fotoUrl?: string | null;
};

const NUEVA: HerramientaEditable = { nombre: "", categoria: "", esMaquina: false, tipoControl: "UNITARIA", marca: "", modelo: "", nroSerie: "", valorCompra: "", mantenimientoCadaDias: "" };

/** Alta y edición en dos pasos. El código SIG-0000 se asigna solo. */
export function FormularioHerramienta({ categorias, inicial = NUEVA, depositos = [] }: { categorias: string[]; inicial?: HerramientaEditable; depositos?: { id: string; nombre: string }[] }) {
  const [d, setD] = useState(inicial);
  const [depositoId, setDepositoId] = useState(depositos[0]?.id ?? "");
  const [cantidad, setCantidad] = useState("");
  const [foto, setFoto] = useState<string | null>(inicial.fotoUrl ?? null);
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const router = useRouter();
  const aviso = useAviso();
  const hoja = useHoja();
  const campo = (k: keyof HerramientaEditable) => ({ id: `h-${k}`, value: d[k] as string, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setD({ ...d, [k]: e.target.value }) });

  return (
    <Pasos
      titulos={["Qué es", "Detalle"]}
      textoFinal={d.id ? "Guardar cambios" : "Agregar"}
      enviando={enviando}
      error={error}
      validar={(i) => (i === 0 && (d.nombre.trim().length < 2 || d.categoria.trim().length < 2) ? "Poné nombre y categoría." : undefined)}
      onFinal={async () => {
        setEnviando(true);
        const r = await guardarHerramienta({ ...d, cantidadInicial: cantidad, depositoId: d.id ? undefined : depositoId, foto: foto && foto.startsWith("data:") ? foto : undefined });
        setEnviando(false);
        if (!r.ok) return setError(r.error);
        hoja.cerrar();
        aviso({ mensaje: d.id ? "Cambios guardados." : `Agregada con el código ${r.datos.codigo}.` });
        if (d.id) router.refresh();
        else router.push(`/herramientas/${r.datos.id}`);
      }}
    >
      <>
        <Campo etiqueta="Nombre" htmlFor="h-nombre"><Entrada {...campo("nombre")} maxLength={80} placeholder="Ej.: Hormigonera 350 l" /></Campo>
        <Campo etiqueta="Categoría" htmlFor="h-categoria" ayuda="Elegí una de la lista o escribí una nueva.">
          <Entrada {...campo("categoria")} list="categorias" maxLength={40} />
          <datalist id="categorias">{categorias.map((c) => <option key={c} value={c} />)}</datalist>
        </Campo>
        <Opciones nombre="Tipo" columnas={2} valor={d.esMaquina ? "maquina" : "herramienta"} onElegir={(v) => setD({ ...d, esMaquina: v === "maquina", tipoControl: v === "maquina" ? "UNITARIA" : d.tipoControl })} opciones={[{ valor: "maquina", titulo: "Máquina", detalle: "Viaja en camión" }, { valor: "herramienta", titulo: "Herramienta" }]} />
        {!d.id && !d.esMaquina && (
          <Opciones nombre="Control" columnas={2} valor={d.tipoControl} onElegir={(v) => setD({ ...d, tipoControl: v as "UNITARIA" })} opciones={[{ valor: "UNITARIA", titulo: "Una sola", detalle: "Se sigue de a una" }, { valor: "CANTIDAD", titulo: "Por cantidad", detalle: "Palas, baldes…" }]} />
        )}
      </>
      <>
        {!d.id && depositos.length > 1 && (
          <Campo etiqueta="¿En qué depósito queda?" htmlFor="h-dep">
            <Selector id="h-dep" value={depositoId} onChange={(e) => setDepositoId(e.target.value)}>
              {depositos.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
            </Selector>
          </Campo>
        )}
        {d.tipoControl === "CANTIDAD" && !d.id ? (
          <Campo etiqueta="Cantidad en el depósito" htmlFor="h-cant"><Entrada id="h-cant" inputMode="numeric" value={cantidad} onChange={(e) => setCantidad(e.target.value.replace(/\D/g, ""))} /></Campo>
        ) : (
          <Campo etiqueta="Número de serie" htmlFor="h-nroSerie"><Entrada {...campo("nroSerie")} maxLength={60} /></Campo>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Marca" htmlFor="h-marca"><Entrada {...campo("marca")} maxLength={40} /></Campo>
          <Campo etiqueta="Modelo" htmlFor="h-modelo"><Entrada {...campo("modelo")} maxLength={40} /></Campo>
          <Campo etiqueta="Valor de compra ($)" htmlFor="h-valorCompra"><Entrada {...campo("valorCompra")} inputMode="decimal" /></Campo>
          <Campo etiqueta="Mantenimiento cada (días)" htmlFor="h-mantenimientoCadaDias"><Entrada {...campo("mantenimientoCadaDias")} inputMode="numeric" placeholder="Opcional" /></Campo>
        </div>
        <CampoFoto etiqueta="Foto" valor={foto} onCambio={setFoto} />
      </>
    </Pasos>
  );
}
