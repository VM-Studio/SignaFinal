import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { exigirSesion } from "@/lib/auth/sesion";
import { puede, rutaPermitida } from "@/lib/permisos";
import { barraInferior, gruposEscritorio, menuMas } from "@/lib/navegacion";
import { ROL } from "@/lib/etiquetas";
import { obrasDelUsuario } from "@/lib/alcance";
import { contarAvisos } from "@/lib/avisos/consultas";
import { tengoViajeEnCurso } from "@/lib/viajes/chofer";
import { contadoresNav } from "@/lib/contadores";
import { ContadoresEnVivo } from "@/components/layout/contadores";
import { SeguimientoChofer } from "@/components/viajes/seguimiento-chofer";
import { VolverAConducir } from "@/components/viajes/volver-a-conducir";
import { BarraInferior, BarraLateral, HeaderEscritorio, HeaderMovil } from "@/components/layout/navegacion";
import { ProveedorAvisos } from "@/components/ui/avisos";
import { IndicadorConexion } from "@/components/layout/conexion";
import { AvisosEnVivo } from "@/components/layout/avisos-en-vivo";
import { TiempoReal } from "@/components/layout/tiempo-real";
import { RefrescoPorRuta, TirarParaActualizar } from "@/components/layout/actualizar";
import { SincronizarPush } from "@/components/layout/sincronizar-push";
import { AjusteTeclado } from "@/components/layout/ajuste-teclado";

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const u = await exigirSesion();
  // Segunda barrera (la primera es el middleware): con el rol leído de la base, por si cambió.
  const ruta = (await headers()).get("x-ruta");
  if (ruta && !rutaPermitida(u.rol, ruta)) redirect("/inicio");

  const deObra = u.rol === "RESPONSABLE_OBRA" || u.rol === "CAPATAZ";
  const chofer = u.rol === "CHOFER";
  const [avisos, obras, enViaje, contadores] = await Promise.all([
    contarAvisos(),
    deObra ? obrasDelUsuario(u) : Promise.resolve(null),
    chofer ? tengoViajeEnCurso() : Promise.resolve(false),
    contadoresNav(u),
  ]);
  const escritorio = gruposEscritorio(u.rol);
  const secciones = [...escritorio.principales, ...escritorio.mas.flatMap((g) => g.items)];
  const perfil = {
    nombre: u.nombre,
    rol: ROL[u.rol],
    obras: !obras ? null : u.rol === "CAPATAZ" ? "Todas las obras" : obras.length ? obras.map((o) => `Obra ${o.nombre}`).join(" · ") : "Todavía ninguna",
  };

  return (
    <ProveedorAvisos>
      <TiempoReal>
      <AvisosEnVivo inicial={avisos}>
      <ContadoresEnVivo inicial={contadores}>
      <RefrescoPorRuta />
      <TirarParaActualizar />
      <BarraLateral principales={escritorio.principales} mas={escritorio.mas} />
      <div className={`flex min-h-dvh flex-col bg-fondo lg:pt-12 lg:pl-[232px] ${puede(u.rol, "dolar.ver") ? "con-dolar" : ""}`}>
        <HeaderMovil perfil={perfil} secciones={secciones} />
        <HeaderEscritorio perfil={perfil} secciones={secciones} dolar={puede(u.rol, "dolar.ver")} />
        <div className="sticky top-[calc(52px+env(safe-area-inset-top))] z-20 lg:top-12">
          <IndicadorConexion />
        </div>
        <main className="@container w-full min-w-0 flex-1 pt-4 pr-[max(16px,env(safe-area-inset-right))] pl-[max(16px,env(safe-area-inset-left))] pb-[calc(56px+24px+env(safe-area-inset-bottom))] lg:p-6">{children}</main>
      </div>
      <BarraInferior items={barraInferior(u.rol)} mas={menuMas(u.rol)} />
      {/* Mientras el chofer está en viaje, el teléfono manda su posición aunque navegue. */}
      {chofer && <SeguimientoChofer activo={enViaje} />}
      {chofer && enViaje && <VolverAConducir />}
      <SincronizarPush />
      <AjusteTeclado />
      </ContadoresEnVivo>
      </AvisosEnVivo>
      </TiempoReal>
    </ProveedorAvisos>
  );
}
