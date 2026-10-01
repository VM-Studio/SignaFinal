import Link from "next/link";
import Image from "next/image";
import { UserCircle2 } from "lucide-react";
import { requerirUsuario } from "@/lib/auth/usuario-actual";
import { NAVEGACION } from "@/lib/navegacion";
import { ROL } from "@/lib/etiquetas";
import { contarAlertasCriticas } from "@/lib/datos/alertas";
import { BarraInferior, BarraLateral } from "@/components/layout/navegacion";
import { IndicadorConexion } from "@/components/layout/conexion";
import { ProveedorAvisos } from "@/components/ui/avisos";

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const usuario = await requerirUsuario();
  const items = NAVEGACION[usuario.rol];
  const alertas = await contarAlertasCriticas(usuario);

  return (
    <ProveedorAvisos>
      <BarraLateral items={items} nombre={usuario.nombre} rol={ROL[usuario.rol]} alertas={alertas} />

      <div className="flex min-h-dvh flex-col lg:pl-60">
        <header className="pt-segura sticky top-0 z-20 bg-negro text-white lg:hidden">
          <div className="flex h-14 items-center justify-between px-4">
            <Link href="/inicio" aria-label="Inicio">
              <Image src="/img/logo-640.png" alt="SIGNA" width={120} height={45} priority className="h-auto w-[104px]" />
            </Link>
            <Link href="/cuenta" className="flex min-h-11 items-center gap-2 text-sm font-semibold text-white/85">
              {usuario.nombre}
              <UserCircle2 className="size-7" />
            </Link>
          </div>
        </header>
        <div className="sticky top-14 z-20 lg:top-0">
          <IndicadorConexion />
        </div>

        <main className="mx-auto w-full flex-1 px-4 pt-4 pb-28 lg:px-8 lg:pt-8 lg:pb-12">{children}</main>
      </div>

      <BarraInferior items={items} alertas={alertas} />
    </ProveedorAvisos>
  );
}
