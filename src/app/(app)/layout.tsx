import { exigirSesion } from "@/lib/auth/sesion";
import { barraInferior, gruposEscritorio, menuMas } from "@/lib/navegacion";
import { ROL } from "@/lib/etiquetas";
import { contarParaCampana } from "@/lib/alertas/consultas";
import { BarraInferior, BarraLateral, HeaderMovil } from "@/components/layout/navegacion";
import { ProveedorAvisos } from "@/components/ui/avisos";
import { IndicadorConexion } from "@/components/layout/conexion";
import { FranjaDemo } from "@/components/layout/franja-demo";
import { modoDemo } from "@/lib/demo";

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const u = await exigirSesion();
  const alertas = await contarParaCampana();

  return (
    <ProveedorAvisos>
      <BarraLateral grupos={gruposEscritorio(u.rol)} nombre={u.nombre} rol={ROL[u.rol]} alertas={alertas} />
      <div className="flex min-h-dvh flex-col bg-fondo lg:pl-60" style={{ ["--franja" as string]: modoDemo() ? "24px" : "0px" }}>
        {modoDemo() && <div className="hidden lg:block"><FranjaDemo /></div>}
        <HeaderMovil rol={u.rol} alertas={alertas} franja={modoDemo() ? <FranjaDemo /> : null} />
        <div className="sticky top-[calc(3.5rem+var(--franja)+env(safe-area-inset-top))] z-20 lg:top-0">
          <IndicadorConexion />
        </div>
        <main className="w-full flex-1 px-4 pt-4 pb-28 lg:p-8">{children}</main>
      </div>
      <BarraInferior items={barraInferior(u.rol)} mas={menuMas(u.rol)} />
    </ProveedorAvisos>
  );
}
