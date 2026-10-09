"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlusCircle } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Hoja } from "@/components/ui/hoja";
import { Campo, Entrada, MensajeError } from "@/components/ui/campos";
import { useAviso } from "@/components/ui/avisos";
import { crearProveedor } from "@/lib/proveedores/acciones";

/** "Nuevo proveedor": nombre, dirección, localidad y teléfono (las coordenadas se buscan solas). */
export function NuevoProveedor() {
  const router = useRouter();
  const aviso = useAviso();
  const [abierta, setAbierta] = useState(false);
  const [d, setD] = useState({ nombre: "", direccion: "", localidad: "", telefono: "" });
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const campo = (k: keyof typeof d) => ({ id: `p-${k}`, value: d[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setD({ ...d, [k]: e.target.value }) });

  async function guardar() {
    setEnviando(true);
    setError(undefined);
    const r = await crearProveedor(d);
    setEnviando(false);
    if (!r.ok) return setError(r.error);
    setAbierta(false);
    aviso({ mensaje: `${d.nombre} cargado. Ubicado en: ${r.datos.encontrada.split(",").slice(0, 3).join(",")}.` });
    setD({ nombre: "", direccion: "", localidad: "", telefono: "" });
    router.refresh();
  }

  return (
    <>
      <Boton icono={<PlusCircle />} onClick={() => setAbierta(true)}>Nuevo proveedor</Boton>
      <Hoja abierta={abierta} onCerrar={() => setAbierta(false)} titulo="Nuevo proveedor">
        <div className="flex flex-col gap-4">
          <Campo etiqueta="Nombre" htmlFor="p-nombre"><Entrada {...campo("nombre")} maxLength={80} autoFocus placeholder="Corralón San Martín" /></Campo>
          <Campo etiqueta="Dirección" htmlFor="p-direccion"><Entrada {...campo("direccion")} maxLength={120} placeholder="Av. San Martín 2450" /></Campo>
          <Campo etiqueta="Localidad" htmlFor="p-localidad" ayuda="Con la dirección se ubica solo en el mapa."><Entrada {...campo("localidad")} maxLength={80} placeholder="Florida" /></Campo>
          <Campo etiqueta="Teléfono (opcional)" htmlFor="p-telefono"><Entrada {...campo("telefono")} maxLength={40} inputMode="tel" /></Campo>
          <MensajeError>{error}</MensajeError>
          <Boton ancho cargando={enviando} disabled={!d.nombre.trim() || !d.direccion.trim() || !d.localidad.trim()} onClick={guardar}>Cargar el proveedor</Boton>
        </div>
      </Hoja>
    </>
  );
}
