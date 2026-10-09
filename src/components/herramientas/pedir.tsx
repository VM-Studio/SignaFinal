"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Opciones } from "@/components/ui/opciones";
import { AreaTexto, Campo, Entrada, Fecha, MensajeError, Selector } from "@/components/ui/campos";
import { Hoja } from "@/components/ui/hoja";
import { useAviso } from "@/components/ui/avisos";
import { pedirHerramienta, type DuplicadoHerramienta } from "@/lib/herramientas/acciones";
import { deshacerPedido } from "@/lib/pedidos/acciones";
import { diaISO, sumarDias } from "@/lib/formato";

export type HerramientaParaPedir = { id: string; nombre: string; tipoControl: "UNITARIA" | "CANTIDAD"; stockDeposito?: number; obraId?: string | null; donde?: string | null };

const unir = (n: string[]) => (n.length <= 1 ? n.join("") : `${n.slice(0, -1).join(", ")} y ${n.at(-1)}`);

/** Dos campos: obra (si tiene una sola, va preseleccionada) y fecha. Y el aviso de duplicado exacto. */
export function FormularioPedirHerramienta({ h, obras, cerrar }: { h: HerramientaParaPedir; obras: { id: string; nombre: string }[]; cerrar: () => void }) {
  const router = useRouter();
  const aviso = useAviso();
  const destinos = obras.filter((o) => o.id !== h.obraId);
  const hoy = diaISO();
  const [obraId, setObraId] = useState(destinos.length === 1 ? destinos[0].id : "");
  const [cual, setCual] = useState<"hoy" | "manana" | "otro">("manana");
  const [otro, setOtro] = useState(sumarDias(hoy, 2));
  const [cant, setCant] = useState("1");
  const [duplicado, setDuplicado] = useState<DuplicadoHerramienta | null>(null);
  const [igual, setIgual] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const dia = cual === "hoy" ? hoy : cual === "manana" ? sumarDias(hoy, 1) : otro;
  const obra = destinos.find((o) => o.id === obraId);

  async function enviar(forzar = false) {
    setError(undefined);
    setEnviando(true);
    const r = await pedirHerramienta({ herramientaId: h.id, obraId, dia, cantidad: cant, forzar, motivo: forzar ? motivo : undefined });
    setEnviando(false);
    if (!r.ok) return setError(r.error);
    if (r.datos.estado === "duplicado") return setDuplicado(r.datos.existente);
    const { pedidoId, choferes, avisado } = r.datos;
    cerrar();
    aviso({
      mensaje: `Pedido enviado. Lo van a ver ${choferes.length ? unir(choferes) : "los choferes"}${avisado ? `; también le avisamos a ${avisado}` : ""}. Te avisamos cuando lo acepten.`,
      deshacer: async () => {
        const x = await deshacerPedido(pedidoId);
        if (!x.ok) aviso({ mensaje: x.error, tono: "error" });
        router.refresh();
      },
    });
    router.refresh();
  }

  if (duplicado) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex gap-3 rounded-[var(--radius-caja)] border border-aviso/15 bg-aviso-fondo p-4">
          <Copy className="mt-0.5 size-6 shrink-0 text-aviso" />
          <p className="text-lg font-semibold">{duplicado.mensaje}</p>
        </div>
        {igual ? (
          <>
            <Campo etiqueta="¿Por qué hace falta otro?" htmlFor="ph-motivo">
              <AreaTexto id="ph-motivo" rows={2} maxLength={200} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej.: hacen falta dos para la losa" />
            </Campo>
            <MensajeError>{error}</MensajeError>
            <Boton ancho disabled={motivo.trim().length < 3} cargando={enviando} onClick={() => enviar(true)}>Pedir igual</Boton>
          </>
        ) : (
          <>
            <Boton ancho onClick={() => { cerrar(); router.push(duplicado.visible ? `/mis-pedidos/${duplicado.id}` : "/mis-pedidos"); }}>Ver ese pedido</Boton>
            <Boton ancho variante="secundario" onClick={() => setIgual(true)}>Pedir igual</Boton>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {h.donde && <p className="text-suave">{h.donde}</p>}
      {destinos.length === 0 ? (
        <p className="font-semibold">Ya está en tu obra.</p>
      ) : destinos.length === 1 ? (
        <p className="rounded-[var(--radius-caja)] bg-papel px-4 py-3 font-semibold">Para Obra {destinos[0].nombre}</p>
      ) : (
        <Campo etiqueta="¿Para qué obra?" htmlFor="ph-obra">
          <Selector id="ph-obra" value={obraId} onChange={(e) => setObraId(e.target.value)}>
            <option value="">Elegí la obra</option>
            {destinos.map((o) => <option key={o.id} value={o.id}>Obra {o.nombre}</option>)}
          </Selector>
        </Campo>
      )}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold">¿Para cuándo la necesitás?</p>
        <Opciones nombre="Día" columnas={3} valor={cual} onElegir={(v) => setCual(v as typeof cual)} opciones={[{ valor: "hoy", titulo: "Hoy" }, { valor: "manana", titulo: "Mañana" }, { valor: "otro", titulo: "Elegir" }]} />
        {cual === "otro" && <Fecha aria-label="Fecha" value={otro} min={hoy} onChange={(e) => setOtro(e.target.value)} />}
      </div>
      {h.tipoControl === "CANTIDAD" && (
        <Campo etiqueta={`Cantidad${h.stockDeposito != null ? ` (hay ${h.stockDeposito})` : ""}`} htmlFor="ph-cant">
          <Entrada id="ph-cant" inputMode="numeric" value={cant} onChange={(e) => setCant(e.target.value.replace(/\D/g, ""))} />
        </Campo>
      )}
      <MensajeError>{error}</MensajeError>
      <Boton ancho disabled={!obraId} cargando={enviando} onClick={() => enviar(false)}>
        La necesito en {obra ? `Obra ${obra.nombre}` : "la obra"}
      </Boton>
    </div>
  );
}

/** Botón "Pedir" de cada fila: abre la hoja. */
export function BotonPedirHerramienta({ h, obras, etiqueta = "Pedir" }: { h: HerramientaParaPedir; obras: { id: string; nombre: string }[]; etiqueta?: string }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <>
      <Boton variante="secundario" tamano="chico" onClick={() => setAbierta(true)}>{etiqueta}</Boton>
      <Hoja abierta={abierta} onCerrar={() => setAbierta(false)} titulo={`Pedir ${h.nombre}`}>
        <div>
          <FormularioPedirHerramienta h={h} obras={obras} cerrar={() => setAbierta(false)} />
        </div>
      </Hoja>
    </>
  );
}
