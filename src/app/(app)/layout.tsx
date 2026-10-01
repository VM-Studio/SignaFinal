import { exigirSesion } from "@/lib/auth/sesion";
import { barraInferior, gruposEscritorio, menuMas } from "@/lib/navegacion";
import { ROL } from "@/lib/etiquetas";
import { contarAlertasAbiertas } from "@/lib/datos/alertas";
import { BarraInferior, BarraLateral, HeaderMovil } from "@/components/layout/navegacion";
import { ProveedorAvisos } from "@/components/ui/avisos";

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const u = await exigirSesion();
  const alertas = await contarAlertasAbiertas();

  return (
    <ProveedorAvisos>
      <BarraLateral grupos={gruposEscritorio(u.rol)} nombre={u.nombre} rol={ROL[u.rol]} alertas={alertas} />
      <div className="flex min-h-dvh flex-col bg-fondo lg:pl-60">
        <HeaderMovil rol={u.rol} alertas={alertas} />
        <main className="w-full flex-1 px-4 pt-4 pb-28 lg:p-8">{children}</main>
      </div>
      <BarraInferior items={barraInferior(u.rol)} mas={menuMas(u.rol)} />
    </ProveedorAvisos>
  );
}
