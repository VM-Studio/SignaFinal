"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Save } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, MensajeError } from "@/components/ui/campos";
import { useAviso } from "@/components/ui/avisos";
import { SubirAdjuntos } from "@/components/adjuntos/subir";
import { adjuntarAPedido, guardarNotasCompras } from "@/lib/materiales/acciones";

/** Notas internas de Compras (el solicitante no las ve). */
export function NotasCompras({ id, inicial }: { id: string; inicial: string }) {
  const aviso = useAviso();
  const [notas, setNotas] = useState(inicial);
  const [guardadas, setGuardadas] = useState(inicial);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="notas-compras" className="flex items-center gap-1 text-[12px] font-medium text-suave"><Lock className="size-3" /> Notas internas de Compras (el que pidió no las ve)</label>
      <AreaTexto id="notas-compras" rows={3} maxLength={2000} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Presupuestos pedidos, con quién se habló, precios…" />
      <MensajeError>{error}</MensajeError>
      {notas !== guardadas && (
        <Boton variante="secundario" tamano="chico" icono={<Save />} cargando={enviando} className="self-start" onClick={async () => {
          setEnviando(true);
          const r = await guardarNotasCompras(id, notas);
          setEnviando(false);
          if (!r.ok) return setError(r.error);
          setGuardadas(notas);
          setError(undefined);
          aviso({ mensaje: "Notas guardadas." });
        }}>Guardar notas</Boton>
      )}
    </div>
  );
}

/** Compras suma archivos al pedido (presupuestos del proveedor). Quedan solo para Compras y el dueño. */
export function AdjuntarCompras({ id }: { id: string }) {
  const router = useRouter();
  const aviso = useAviso();
  const [ids, setIds] = useState<string[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [clave, setClave] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <div className="flex flex-col gap-2">
      <SubirAdjuntos key={clave} entidadTipo="PEDIDO_MATERIAL" interno compacto etiqueta="Adjuntar presupuesto u otro archivo" onCambio={(x, s) => { setIds(x); setSubiendo(s); }} />
      <MensajeError>{error}</MensajeError>
      {ids.length > 0 && (
        <Boton tamano="chico" className="self-start" cargando={enviando} disabled={subiendo} onClick={async () => {
          setEnviando(true);
          const r = await adjuntarAPedido(id, ids);
          setEnviando(false);
          if (!r.ok) return setError(r.error);
          aviso({ mensaje: `${r.datos.cantidad === 1 ? "Archivo agregado" : `${r.datos.cantidad} archivos agregados`} al pedido.` });
          setIds([]);
          setClave((k) => k + 1);
          router.refresh();
        }}>Guardar {ids.length === 1 ? "el archivo" : `${ids.length} archivos`}</Boton>
      )}
    </div>
  );
}
