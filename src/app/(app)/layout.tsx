import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { exigirSesion } from "@/lib/auth/sesion";
import { rutaPermitida } from "@/lib/permisos";
import { barraInferior, gruposEscritorio, menuMas } from "@/lib/navegacion";
import { ROL } from "@/lib/etiquetas";
import { obrasDelUsuario } from "@/lib/alcance";
import { contarAvisos } from "@/lib/avisos/consultas";
import { tengoViajeEnCurso, ultimaSolicitud } from "@/lib/viajes/chofer";
import { SeguimientoChofer } from "@/components/viajes/seguimiento-chofer";
import { BarraInferior, BarraLateral, HeaderMovil } from "@/components/layout/navegacion";
import { ProveedorAvisos } from "@/components/ui/avisos";
import { IndicadorConexion } from "@/components/layout/conexion";

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const u = await exigirSesion();
  // Segunda barrera (la primera es el middleware): con el rol leído de la base, por si cambió.
  const ruta = (await headers()).get("x-ruta");
  if (ruta && !rutaPermitida(u.rol, ruta)) redirect("/inicio");

  const deObra = u.rol === "RESPONSABLE_OBRA" || u.rol === "CAPATAZ";
  const chofer = u.rol === "CHOFER";
  const [avisos, obras, enViaje, ultima] = await Promise.all([
    contarAvisos(),
    deObra ? obrasDelUsuario(u) : Promise.resolve(null),
    chofer ? tengoViajeEnCurso() : Promise.resolve(false),
    chofer ? ultimaSolicitud() : Promise.resolve(null),
  ]);
  const perfil = {
    nombre: u.nombre,
    rol: ROL[u.rol],
    obras: !obras ? null : u.rol === "CAPATAZ" ? "Todas las obras" : obras.length ? obras.map((o) => `Obra ${o.nombre}`).join(" · ") : "Todavía ninguna",
  };

  return (
    <ProveedorAvisos>
      <BarraLateral grupos={gruposEscritorio(u.rol)} perfil={perfil} avisos={avisos} />
      <div className="flex min-h-dvh flex-col bg-fondo lg:pl-60">
        <HeaderMovil perfil={perfil} avisos={avisos} />
        <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 lg:top-0">
          <IndicadorConexion />
        </div>
        <main className="w-full flex-1 px-4 pt-4 pb-28 lg:p-8">{children}</main>
      </div>
      <BarraInferior items={barraInferior(u.rol)} mas={menuMas(u.rol)} conSalir={chofer} nuevas={chofer ? { href: "/solicitudes", ultima: ultima?.toISOString() ?? null } : undefined} />
      {/* Mientras el chofer está en viaje, el teléfono manda su posición aunque navegue. */}
      {chofer && <SeguimientoChofer activo={enViaje} />}
    </ProveedorAvisos>
  );
}
