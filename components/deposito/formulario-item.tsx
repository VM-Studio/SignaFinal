"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pasos } from "@/components/ui/pasos";
import { Opciones } from "@/components/ui/opciones";
import { Campo, Entrada } from "@/components/ui/campos";
import { useAviso } from "@/components/ui/avisos";
import { usePanel } from "@/components/ui/panel";
import { guardarItem, type DatosItem } from "@/lib/acciones/deposito";
import { CATEGORIA_ITEM } from "@/lib/etiquetas";

export function FormularioItem() {
  const [d, setD] = useState({ nombre: "", categoria: "", control: "", marca: "", modelo: "", numeroSerie: "", unidad: "unidades", cantidadInicial: "" });
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const router = useRouter();
  const aviso = useAviso();
  const panel = usePanel();
  const campo = (k: keyof typeof d) => ({ id: `item-${k}`, value: d[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setD({ ...d, [k]: e.target.value }) });

  async function guardar() {
    setEnviando(true);
    const r = await guardarItem({ ...d, categoria: d.categoria as DatosItem["categoria"], control: d.control as DatosItem["control"] });
    setEnviando(false);
    if (!r.ok) return setError(r.error);
    aviso({ mensaje: `${d.nombre} agregado al depósito.` });
    panel.cerrar();
    router.push(`/deposito/${r.datos.id}`);
  }

  return (
    <Pasos
      titulos={["Qué es", "Detalle"]}
      textoFinal="Agregar al depósito"
      onFinal={guardar}
      enviando={enviando}
      error={error}
      validar={(i) => (i === 0 && (d.nombre.trim().length < 2 || !d.categoria || !d.control) ? "Completá nombre, categoría y cómo se controla." : undefined)}
    >
      <>
        <Campo etiqueta="Nombre" htmlFor="item-nombre">
          <Entrada {...campo("nombre")} maxLength={80} placeholder="Ej.: Hormigonera 350 l" />
        </Campo>
        <Opciones nombre="Categoría" columnas={2} valor={d.categoria} onElegir={(categoria) => setD({ ...d, categoria })} opciones={Object.entries(CATEGORIA_ITEM).map(([valor, titulo]) => ({ valor, titulo }))} />
        <Opciones
          nombre="Control"
          valor={d.control}
          onElegir={(control) => setD({ ...d, control })}
          opciones={[
            { valor: "UNITARIA", titulo: "Una sola unidad", detalle: "Máquina o herramienta con QR propio" },
            { valor: "CANTIDAD", titulo: "Por cantidad", detalle: "Palas, baldes, puntales, sobrantes" },
          ]}
        />
      </>
      <>
        {d.control === "CANTIDAD" ? (
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Cantidad en depósito" htmlFor="item-cantidadInicial">
              <Entrada {...campo("cantidadInicial")} inputMode="numeric" />
            </Campo>
            <Campo etiqueta="Unidad" htmlFor="item-unidad">
              <Entrada {...campo("unidad")} maxLength={20} />
            </Campo>
          </div>
        ) : (
          <Campo etiqueta="Número de serie" htmlFor="item-numeroSerie">
            <Entrada {...campo("numeroSerie")} maxLength={60} />
          </Campo>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Marca" htmlFor="item-marca">
            <Entrada {...campo("marca")} maxLength={40} />
          </Campo>
          <Campo etiqueta="Modelo" htmlFor="item-modelo">
            <Entrada {...campo("modelo")} maxLength={40} />
          </Campo>
        </div>
      </>
    </Pasos>
  );
}
