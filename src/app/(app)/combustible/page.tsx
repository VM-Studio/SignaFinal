import type { Metadata } from "next";
import { FileImage, Fuel } from "lucide-react";
import { exigirPermiso } from "@/lib/auth/sesion";
import { puede } from "@/lib/permisos";
import { datosCarga, misCargas } from "@/lib/viajes/consultas";
import { Subtitulo, Titulo, Vacio } from "@/components/ui/basicos";
import { FormularioCombustible } from "@/components/viajes/formulario-combustible";
import { cuando, litros, plata } from "@/lib/formato";

export const metadata: Metadata = { title: "Combustible" };

export default async function PaginaCombustible() {
  const u = await exigirPermiso("combustible.ver");
  const puedeCargar = puede(u.rol, "combustible.cargar");
  const [form, cargas] = await Promise.all([puedeCargar ? datosCarga() : null, misCargas()]);

  return (
    <div className="grid gap-x-8 gap-y-2 lg:grid-cols-[420px_1fr]">
      {form && (
        <section>
          <Titulo>Cargar combustible</Titulo>
          <FormularioCombustible {...form} />
        </section>
      )}
      <section className={form ? "" : "lg:col-span-2"}>
        <Subtitulo>{u.rol === "CHOFER" ? "Tus últimas cargas" : "Últimas cargas"}</Subtitulo>
        {cargas.length === 0 ? (
          <Vacio icono={<Fuel className="size-8" />} titulo="Sin cargas registradas" />
        ) : (
          <ul className="divide-y divide-linea overflow-hidden rounded-[var(--radius-caja)] border border-linea bg-papel">
            {cargas.map((c) => (
              <li key={c.id} className="flex min-h-16 items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{c.vehiculo.nombre} · {litros(c.litros)}</p>
                  <p className="text-sm text-suave">
                    {cuando(c.fecha)} · {c.usuario.nombre}
                    {c.obra ? ` · Obra ${c.obra.nombre}` : ""}
                  </p>
                </div>
                <p className="font-bold tabular-nums">{plata(c.monto)}</p>
                {c.comprobanteUrl && (
                  <a href={c.comprobanteUrl} target="_blank" rel="noopener" aria-label="Ver ticket" className="grid size-11 place-items-center rounded-md hover:bg-black/5">
                    <FileImage className="size-5" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
