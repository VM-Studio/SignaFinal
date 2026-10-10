"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, PackageOpen, Send, Split } from "lucide-react";
import { Boton, BotonLink } from "@/components/ui/boton";
import { Opciones } from "@/components/ui/opciones";
import { Entrada, Fecha, MensajeError } from "@/components/ui/campos";
import { Vacio } from "@/components/ui/basicos";
import { useAviso } from "@/components/ui/avisos";
import { deshacerRetiro, pedirRetiro } from "@/lib/materiales/acciones";
import type { ListoParaRetirar } from "@/lib/materiales/consultas";
import { haceDias } from "@/lib/materiales/presentacion";
import { diaISO, peso, sumarDias } from "@/lib/formato";

/**
 * Pedir el viaje de retiro: 1 obra · 2 qué retirar (lo que habilitó Compras, se marcan varios) · 3 para cuándo.
 * Un viaje por proveedor.
 */
export function RetiroMateriales({ obras, listos, obraInicial, materialInicial }: {
  obras: { id: string; nombre: string }[]; listos: Record<string, ListoParaRetirar[]>; obraInicial?: string; materialInicial?: string;
}) {
  const router = useRouter();
  const aviso = useAviso();
  const unaObra = obraInicial && obras.some((o) => o.id === obraInicial) ? obraInicial : obras.length === 1 ? obras[0].id : "";
  const [obraId, setObraId] = useState(unaObra);
  const [paso, setPaso] = useState<1 | 2 | 3>(unaObra ? 2 : 1);
  const [marcados, setMarcados] = useState<string[]>(materialInicial && (listos[unaObra] ?? []).some((m) => m.id === materialInicial) ? [materialInicial] : []);
  const hoy = diaISO();
  const [dia, setDia] = useState<"hoy" | "manana" | "fecha">("hoy");
  const [fecha, setFecha] = useState(sumarDias(hoy, 2));
  const [franja, setFranja] = useState<"MANANA" | "TARDE" | "HORA_EXACTA">("MANANA");
  const [hora, setHora] = useState("09:00");
  const [prioridad, setPrioridad] = useState<"NORMAL" | "URGENTE">("NORMAL");
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);

  const obra = obras.find((o) => o.id === obraId);
  const disponibles = listos[obraId] ?? [];
  const elegidos = disponibles.filter((m) => marcados.includes(m.id));
  const proveedores = [...new Set(elegidos.map((m) => m.proveedor))];
  const marcar = (id: string) => setMarcados((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]));

  async function enviar() {
    setEnviando(true);
    setError(undefined);
    const r = await pedirRetiro({ obraId, materiales: marcados, prioridad, franja, hora: franja === "HORA_EXACTA" ? hora : undefined, dia: dia === "hoy" ? hoy : dia === "manana" ? sumarDias(hoy, 1) : fecha });
    setEnviando(false);
    if (!r.ok) return setError(r.error);
    const { pedidos } = r.datos;
    aviso({
      mensaje: pedidos.length === 1 ? `Viaje pedido: retiro en ${pedidos[0].proveedor}. Lo ven los choferes.` : `Se pidieron ${pedidos.length} viajes, uno por proveedor. Los ven los choferes.`,
      deshacer: async () => {
        const x = await deshacerRetiro(pedidos.map((p) => p.id));
        if (!x.ok) aviso({ mensaje: x.error, tono: "error" });
        router.refresh();
      },
    });
    router.push(pedidos.length === 1 ? `/mis-pedidos/${pedidos[0].id}` : "/mis-pedidos");
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        {paso > 1 && (
          <button type="button" onClick={() => setPaso((paso - 1) as 1 | 2)} aria-label="Volver" className="-ml-2 grid size-11 place-items-center rounded-md hover:bg-black/5">
            <ArrowLeft className="size-6" />
          </button>
        )}
        <div className="flex-1">
          <p className="text-sm font-semibold text-suave">Retiro en proveedor · Paso {paso} de 3</p>
          <div className="mt-1.5 flex gap-1">
            {[1, 2, 3].map((n) => <span key={n} className={`h-1 flex-1 rounded-full ${n <= paso ? "bg-tinta" : "bg-linea"}`} />)}
          </div>
        </div>
      </div>

      {paso === 1 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-2xl font-semibold">¿Para qué obra?</h2>
          <Opciones
            nombre="Obra" valor={obraId}
            onElegir={(v) => { setObraId(v); setMarcados([]); setPaso(2); }}
            opciones={obras.map((o) => {
              const n = (listos[o.id] ?? []).length;
              return { valor: o.id, titulo: `Obra ${o.nombre}`, detalle: n ? `${n} ${n === 1 ? "material listo" : "materiales listos"} para retirar` : "Nada listo para retirar" };
            })}
          />
        </section>
      )}

      {paso === 2 && obra && (
        <section className="flex flex-col gap-3">
          <h2 className="text-2xl font-semibold">¿Qué hay que retirar?</h2>
          {disponibles.length === 0 ? (
            <Vacio icono={<PackageOpen className="size-10" />} titulo={`No tenés materiales listos para retirar en ${obra.nombre}.`} accion={<BotonLink href="/mis-pedidos?tab=materiales" variante="secundario">Ver mis pedidos de material</BotonLink>}>
              Aparecen acá cuando Compras los habilita.
            </Vacio>
          ) : (
            <>
              <ul className="flex flex-col gap-2" role="group" aria-label="Materiales listos">
                {disponibles.map((m) => {
                  const si = marcados.includes(m.id);
                  return (
                    <li key={m.id}>
                      <button type="button" role="checkbox" aria-checked={si} onClick={() => marcar(m.id)}
                        className={`flex min-h-16 w-full items-start gap-3 rounded-[var(--radius-caja)] border px-4 py-3 text-left ${si ? "border-tinta bg-hover text-tinta" : "border-linea bg-papel hover:border-linea-fuerte"}`}>
                        <span aria-hidden className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded border ${si ? "border-white bg-white text-negro" : "border-linea-fuerte"}`}>
                          {si && <Check className="size-4" strokeWidth={3} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block leading-tight font-semibold">{m.descripcion}</span>
                          <span className={`mt-0.5 block text-sm text-suave`}>
                            {[m.proveedor, m.pesoKg ? `hasta ${peso(m.pesoKg)}` : null, `listo ${haceDias(new Date(m.habilitadoEn))}`].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {proveedores.length > 1 && (
                <p className="flex gap-2 rounded-[var(--radius-caja)] border border-aviso/15 bg-aviso-fondo p-3 font-semibold">
                  <Split className="mt-0.5 size-5 shrink-0 text-aviso-texto" /> Son {proveedores.length} proveedores, se van a crear {proveedores.length} viajes.
                </p>
              )}
              <MensajeError>{error}</MensajeError>
              <Boton ancho disabled={!marcados.length} onClick={() => setPaso(3)}>Siguiente</Boton>
            </>
          )}
        </section>
      )}

      {paso === 3 && (
        <section className="flex flex-col gap-5">
          <h2 className="text-2xl font-semibold">¿Para cuándo?</h2>
          <div className="flex flex-col gap-2">
            <Opciones nombre="Día" columnas={3} valor={dia} onElegir={(v) => setDia(v as typeof dia)} opciones={[{ valor: "hoy", titulo: "Hoy" }, { valor: "manana", titulo: "Mañana" }, { valor: "fecha", titulo: "Elegir fecha" }]} />
            {dia === "fecha" && <Fecha aria-label="Fecha" value={fecha} min={hoy} onChange={(e) => setFecha(e.target.value)} />}
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold">Hora aproximada</p>
            <Opciones nombre="Hora" columnas={3} valor={franja} onElegir={(v) => setFranja(v as typeof franja)} opciones={[{ valor: "MANANA", titulo: "Mañana" }, { valor: "TARDE", titulo: "Tarde" }, { valor: "HORA_EXACTA", titulo: "Hora exacta" }]} />
            {franja === "HORA_EXACTA" && <Entrada type="time" aria-label="Hora exacta" value={hora} onChange={(e) => setHora(e.target.value)} />}
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold">Prioridad</p>
            <Opciones nombre="Prioridad" columnas={2} valor={prioridad} onElegir={(v) => setPrioridad(v as typeof prioridad)} opciones={[{ valor: "NORMAL", titulo: "Normal" }, { valor: "URGENTE", titulo: "Urgente" }]} />
            <p className="text-sm text-suave">Urgente solo si la obra se para sin esto.</p>
          </div>
          <MensajeError>{error}</MensajeError>
          <Boton ancho cargando={enviando} onClick={enviar} icono={<Send />}>
            {proveedores.length > 1 ? `Pedir los ${proveedores.length} viajes` : "Pedir el viaje"}
          </Boton>
        </section>
      )}
    </div>
  );
}
