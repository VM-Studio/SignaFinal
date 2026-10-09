import Link from "next/link";
import { Wrench } from "lucide-react";
import type { UsuarioSesion } from "@/lib/auth/sesion";
import { herramientasParaObra } from "@/lib/herramientas/consultas";
import { obrasDelUsuario } from "@/lib/alcance";
import { Buscador } from "@/components/ui/campos";
import { Insignia, Pestanas, Titulo, Vacio } from "@/components/ui/basicos";
import { BotonPedirHerramienta } from "./pedir";
import { CargarMas } from "@/components/ui/cargar-mas";
import { limiteDe } from "@/lib/pagina";

/**
 * Herramientas para la gente de obra: arranca SIEMPRE en "Disponibles para pedir".
 * "Ver todas" muestra dónde está cada una y quién la tiene; se puede pedir la que está en otra obra.
 */
export async function VistaObra({ u, vista, q, n }: { u: UsuarioSesion; vista: "disponibles" | "todas"; q?: string; n?: string }) {
  const { limite, siguiente } = await limiteDe(n);
  const [{ filas, hayMas }, obras] = await Promise.all([herramientasParaObra({ vista, q, limite }), obrasDelUsuario(u)]);
  const misObras = obras.map((o) => ({ id: o.id, nombre: o.nombre }));
  const href = (v: string) => `/herramientas?vista=${v}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
  return (
    <div>
      <Titulo
        detalle={vista === "disponibles" ? "Lo que está en el depósito y se puede pedir para tu obra." : "Todas, con dónde está cada una y quién la tiene."}
      >
        Herramientas
      </Titulo>
      <Pestanas items={[{ href: href("disponibles"), etiqueta: "Disponibles para pedir", activa: vista === "disponibles" }, { href: href("todas"), etiqueta: "Ver todas", activa: vista === "todas" }]} />
      <div className="mb-3">
        <Buscador accion="/herramientas" valor={q} placeholder="Buscar por nombre o código (SIG-0001)" ocultos={{ vista }} />
      </div>
      {filas.length === 0 ? (
        <Vacio icono={<Wrench className="size-10" />} titulo={q ? `No hay nada con "${q}"` : "No hay herramientas disponibles"}>
          {vista === "disponibles" ? "Probá en \"Ver todas\": la que buscás puede estar en otra obra." : undefined}
        </Vacio>
      ) : (
        <ul className="divide-y divide-linea overflow-hidden rounded-[var(--radius-caja)] border border-linea bg-papel">
          {filas.map((h) => {
            const destinos = misObras.filter((o) => o.id !== h.obraId);
            return (
              <li key={h.id} className="flex items-center gap-3 px-4 py-3">
                <Link href={`/herramientas/${h.id}`} className="min-w-0 flex-1">
                  <p className="font-semibold">{h.nombre}</p>
                  <p className="text-sm text-suave tabular-nums">{h.codigo} · {h.categoria}</p>
                  <div className="mt-1.5"><Insignia tono={h.tono}>{h.estado}</Insignia></div>
                </Link>
                {h.sePuedePedir && destinos.length > 0 && (
                  <BotonPedirHerramienta
                    h={{ id: h.id, nombre: h.nombre, tipoControl: h.tipoControl, stockDeposito: h.stockDeposito, obraId: h.obraId, donde: h.estado }}
                    obras={misObras}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
      {hayMas && <CargarMas href={`${href(vista)}&n=${siguiente}`} />}
    </div>
  );
}
