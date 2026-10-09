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
import { BarraInferior, BarraLateral, HeaderEscritorio, HeaderMovil } from "@/components/layout/navegacion";
import { ProveedorAvisos } from "@/components/ui/avisos";
import { IndicadorConexion } from "@/components/layout/conexion";
import { AvisosEnVivo } from "@/components/layout/avisos-en-vivo";
import { SincronizarPush } from "@/components/layout/sincronizar-push";

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
      <AvisosEnVivo inicial={avisos}>
      <BarraLateral grupos={gruposEscritorio(u.rol)} />
      <div className="flex min-h-dvh flex-col bg-fondo lg:pt-12 lg:pl-[232px]">
        <HeaderMovil perfil={perfil} />
        <HeaderEscritorio perfil={perfil} />
        <div className="sticky top-[calc(52px+env(safe-area-inset-top))] z-20 lg:top-12">
          <IndicadorConexion />
        </div>
        <main className="w-full min-w-0 flex-1 px-4 pt-4 pb-[calc(56px+24px+env(safe-area-inset-bottom))] lg:p-6">{children}</main>
      </div>
      <BarraInferior items={barraInferior(u.rol)} mas={menuMas(u.rol)} conSalir={chofer} nuevas={chofer ? { href: "/solicitudes", ultima: ultima?.toISOString() ?? null } : undefined} />
      {/* Mientras el chofer está en viaje, el teléfono manda su posición aunque navegue. */}
      {chofer && <SeguimientoChofer activo={enViaje} />}
      <SincronizarPush />
      </AvisosEnVivo>
    </ProveedorAvisos>
  );
}
