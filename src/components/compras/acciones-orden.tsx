"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, PackageCheck, Pencil, Undo2 } from "lucide-react";
import type { EstadoTablero, SemaforoPE } from "@prisma/client";
import { Boton, BotonLink } from "@/components/ui/boton";
import { Selector } from "@/components/ui/campos";
import { useAviso } from "@/components/ui/avisos";
import { ajustarEstadoTablero, autorizarOrdenPago, cambiarSemaforoPE, marcarEncargada } from "@/lib/compras/acciones";
import { ESTADO_TABLERO, ESTADOS_TABLERO, SEMAFORO_PE } from "@/lib/compras/estadoTablero";
import type { OCPlana } from "@/lib/compras/consultas";
import { BotonAnularOC, BotonCorregirOC } from "./botones-oc";

/** Las acciones de una orden según quién mira: Compras edita, ajusta el estado y encarga; el dueño autoriza la orden de pago. */
export function AccionesOrden({ oc, editable, autorizaPago }: { oc: OCPlana; editable: boolean; autorizaPago: boolean }) {
  const router = useRouter();
  const aviso = useAviso();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const correr = async (clave: string, f: () => Promise<{ ok: true } | { ok: false; error: string }>, ok?: string) => {
    setOcupado(clave);
    const r = await f();
    setOcupado(null);
    if (!r.ok) return aviso({ mensaje: r.error, tono: "error" });
    if (ok) aviso({ mensaje: ok });
    router.refresh();
  };
  const sistema = oc.fuente === "SISTEMA";
  const editablePlantilla = sistema && ["BORRADOR", "ESPERANDO_APROBACION", "APROBADA"].includes(oc.estado);
  const puedeAnular = sistema && ["BORRADOR", "ESPERANDO_APROBACION", "APROBADA"].includes(oc.estado);
  const puedeCorregir = sistema && ["RECHAZADA", "ANULADA"].includes(oc.estado) && !!oc.pedidoMaterialId;
  const pagoAutorizable = autorizaPago && (oc.estado === "APROBADA" || oc.estado === "ESPERANDO_APROBACION" || oc.fuente === "IMPORTADA_EXCEL");
  if (!editable && !pagoAutorizable) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {editable && editablePlantilla && <BotonLink href={`/compras/ordenes/${oc.id}`} variante="primario" tamano="chico" icono={<Pencil />}>{oc.estado === "BORRADOR" ? "Seguir completando" : "Editar"}</BotonLink>}
        {editable && sistema && oc.estado === "APROBADA" && (
          <Boton variante="secundario" tamano="chico" icono={<PackageCheck />} cargando={ocupado === "enc"} onClick={() => correr("enc", () => marcarEncargada(oc.id, !oc.encargadaEn), oc.encargadaEn ? "Ya no figura como encargada." : "Marcada como encargada al proveedor.")}>
            {oc.encargadaEn ? "Desmarcar encargado" : "Encargado al proveedor"}
          </Boton>
        )}
        {pagoAutorizable && (
          <Boton variante={oc.ordenPagoAutorizadaEn ? "secundario" : "primario"} tamano="chico" icono={oc.ordenPagoAutorizadaEn ? <Undo2 /> : <BadgeCheck />} cargando={ocupado === "op"}
            onClick={() => correr("op", () => autorizarOrdenPago(oc.id, !oc.ordenPagoAutorizadaEn), oc.ordenPagoAutorizadaEn ? "Se quitó la autorización de pago." : "Orden de pago autorizada.")}>
            {oc.ordenPagoAutorizadaEn ? "Quitar autorización de pago" : "Autorizar la orden de pago"}
          </Boton>
        )}
      </div>
      {editable && (
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-[12px] text-suave">
            Estado en el tablero
            <Selector value={oc.estadoTablero ?? ""} disabled={ocupado === "est"} onChange={(e) => correr("est", () => ajustarEstadoTablero(oc.id, (e.target.value || null) as EstadoTablero | null), "Estado actualizado.")}>
              <option value="">Sin estado</option>
              {ESTADOS_TABLERO.map((s) => <option key={s} value={s}>{ESTADO_TABLERO[s].titulo}{oc.estadoTableroAuto === s && oc.fuente === "SISTEMA" ? " (según el circuito)" : ""}</option>)}
            </Selector>
          </label>
          {oc.tipo === "PE" && (
            <label className="text-[12px] text-suave">
              Estado de la orden (PE)
              <Selector value={oc.semaforoPE ?? "NADA_TODAVIA"} disabled={ocupado === "sem"} onChange={(e) => correr("sem", () => cambiarSemaforoPE(oc.id, e.target.value as SemaforoPE))}>
                {(Object.keys(SEMAFORO_PE) as SemaforoPE[]).map((s) => <option key={s} value={s}>{SEMAFORO_PE[s].titulo}{SEMAFORO_PE[s].detalle ? ` (${SEMAFORO_PE[s].detalle})` : ""}</option>)}
              </Selector>
            </label>
          )}
        </div>
      )}
      {editable && (puedeAnular || puedeCorregir) && (
        <div className="flex flex-wrap gap-2">
          {puedeCorregir && <div className="w-full sm:w-auto"><BotonCorregirOC ocId={oc.id} /></div>}
          {puedeAnular && <div className="w-full sm:w-auto"><BotonAnularOC ocId={oc.id} numero={oc.numero} /></div>}
        </div>
      )}
    </div>
  );
}
