"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, PackageCheck, Truck } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Opciones } from "@/components/ui/opciones";
import { Campo, Entrada, MensajeError, Selector } from "@/components/ui/campos";
import { useAviso } from "@/components/ui/avisos";
import { cambiarEstadoItem, deshacerMovimiento, moverItem } from "@/lib/acciones/deposito";
import { ESTADO_ITEM } from "@/lib/etiquetas";

type Obra = { id: string; nombre: string };
type Persona = { id: string; nombre: string };

/** Entregar, recibir o transferir. Elegir de listas; cantidad solo si va por cantidad. */
export function AccionesItem({
  itemId, nombre, control, unidad, estado, enDeposito, enObras, obras, personas, puedeEditar,
}: {
  itemId: string;
  nombre: string;
  control: "UNITARIA" | "CANTIDAD";
  unidad: string | null;
  estado: "OPERATIVO" | "EN_REPARACION" | "FUERA_DE_SERVICIO";
  enDeposito: number;
  enObras: { obraId: string; obra: string; cantidad: number }[];
  obras: Obra[];
  personas: Persona[];
  puedeEditar: boolean;
}) {
  const [modo, setModo] = useState<"ENTREGA" | "DEVOLUCION" | "TRANSFERENCIA" | null>(null);
  const [desde, setDesde] = useState<string>(enObras[0]?.obraId ?? "");
  const [hacia, setHacia] = useState<string>("");
  const [recibe, setRecibe] = useState<string>("");
  const [cantidad, setCantidad] = useState("1");
  const [error, setError] = useState<string>();
  const [pendiente, iniciar] = useTransition();
  const aviso = useAviso();
  const router = useRouter();
  const porCantidad = control === "CANTIDAD";

  function confirmar() {
    setError(undefined);
    iniciar(async () => {
      const r = await moverItem({
        itemId,
        tipo: modo!,
        cantidad,
        desdeObraId: modo === "ENTREGA" ? null : desde,
        haciaObraId: modo === "DEVOLUCION" ? null : hacia,
        recibidoPorId: recibe || null,
      });
      if (!r.ok) return setError(r.error);
      const texto = modo === "ENTREGA" ? "Entregado." : modo === "DEVOLUCION" ? "Recibido en el depósito." : "Transferido.";
      aviso({
        mensaje: `${nombre}: ${texto}`,
        deshacer: async () => {
          const d = await deshacerMovimiento(r.datos.movimientoId);
          if (!d.ok) aviso({ mensaje: d.error, tono: "error" });
          router.refresh();
        },
      });
      setModo(null);
      setHacia("");
      setRecibe("");
      setCantidad("1");
      router.refresh();
    });
  }

  if (!modo) {
    return (
      <div className="flex flex-col gap-2">
        {enDeposito > 0 && (
          <Boton ancho tamano="grande" icono={<Truck className="size-5" />} onClick={() => setModo("ENTREGA")} disabled={estado !== "OPERATIVO"}>
            Entregar a obra
          </Boton>
        )}
        {enObras.length > 0 && (
          <Boton ancho tamano="grande" variante={enDeposito > 0 ? "secundario" : "primario"} icono={<PackageCheck className="size-5" />} onClick={() => setModo("DEVOLUCION")}>
            Recibir en el depósito
          </Boton>
        )}
        {enObras.length > 0 && (
          <Boton ancho variante="fantasma" icono={<ArrowRightLeft className="size-5" />} onClick={() => setModo("TRANSFERENCIA")}>
            Pasar a otra obra
          </Boton>
        )}
        {estado !== "OPERATIVO" && enDeposito > 0 && <p className="text-sm font-medium text-aviso">{ESTADO_ITEM[estado].texto}: no se puede entregar.</p>}
        {puedeEditar && <EstadoItem itemId={itemId} estado={estado} />}
      </div>
    );
  }

  const maximo = modo === "ENTREGA" ? enDeposito : enObras.find((o) => o.obraId === desde)?.cantidad ?? 0;
  const listo = (modo === "ENTREGA" ? !!hacia : !!desde) && (modo !== "TRANSFERENCIA" || (!!hacia && hacia !== desde)) && Number(cantidad) >= 1;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-bold">{modo === "ENTREGA" ? "¿A qué obra va?" : modo === "DEVOLUCION" ? "¿De qué obra vuelve?" : "Pasar a otra obra"}</h2>
      {modo !== "ENTREGA" && (
        <Opciones nombre="Desde" valor={desde} onElegir={setDesde} opciones={enObras.map((o) => ({ valor: o.obraId, titulo: `Obra ${o.obra}`, detalle: porCantidad ? `Hay ${o.cantidad} ${unidad ?? ""}` : undefined }))} />
      )}
      {modo !== "DEVOLUCION" && (
        <Campo etiqueta={modo === "TRANSFERENCIA" ? "A la obra" : "Obra"} htmlFor="hacia">
          <Selector id="hacia" value={hacia} onChange={(e) => setHacia(e.target.value)}>
            <option value="">Elegí la obra</option>
            {obras.filter((o) => o.id !== desde || modo === "ENTREGA").map((o) => (
              <option key={o.id} value={o.id}>Obra {o.nombre}</option>
            ))}
          </Selector>
        </Campo>
      )}
      <div className={`grid gap-3 ${porCantidad ? "grid-cols-2" : ""}`}>
        {porCantidad && (
          <Campo etiqueta={`Cantidad (hay ${maximo})`} htmlFor="cantidad">
            <Entrada id="cantidad" inputMode="numeric" value={cantidad} onChange={(e) => setCantidad(e.target.value.replace(/\D/g, ""))} />
          </Campo>
        )}
        {modo !== "DEVOLUCION" && (
          <Campo etiqueta="Quién recibe" htmlFor="recibe">
            <Selector id="recibe" value={recibe} onChange={(e) => setRecibe(e.target.value)}>
              <option value="">—</option>
              {personas.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </Selector>
          </Campo>
        )}
      </div>
      <MensajeError>{error}</MensajeError>
      <div className="grid grid-cols-[auto_1fr] gap-2">
        <Boton variante="secundario" onClick={() => setModo(null)}>Volver</Boton>
        <Boton disabled={!listo} cargando={pendiente} onClick={confirmar}>Confirmar</Boton>
      </div>
    </div>
  );
}

function EstadoItem({ itemId, estado }: { itemId: string; estado: "OPERATIVO" | "EN_REPARACION" | "FUERA_DE_SERVICIO" }) {
  const [pendiente, iniciar] = useTransition();
  const router = useRouter();
  const aviso = useAviso();
  return (
    <div className="mt-3">
      <p className="mb-2 text-sm font-semibold text-suave">Estado</p>
      <Opciones
        nombre="Estado"
        valor={estado}
        onElegir={(v) =>
          !pendiente &&
          iniciar(async () => {
            const anterior = estado;
            const r = await cambiarEstadoItem(itemId, v as typeof estado);
            if (!r.ok) return aviso({ mensaje: r.error, tono: "error" });
            aviso({ mensaje: `Ahora: ${ESTADO_ITEM[v as typeof estado].texto}.`, deshacer: async () => { await cambiarEstadoItem(itemId, anterior); router.refresh(); } });
            router.refresh();
          })
        }
        opciones={Object.entries(ESTADO_ITEM).map(([valor, e]) => ({ valor, titulo: e.texto }))}
      />
    </div>
  );
}
