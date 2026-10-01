import type { Metadata } from "next";
import { requerirUsuario } from "@/lib/auth/usuario-actual";
import { solicitudes } from "@/lib/datos/deposito";
import { Subtitulo, Titulo, Vacio } from "@/components/ui/basicos";
import { SolicitudDeposito, SolicitudObra } from "@/components/deposito/solicitudes";

export const metadata: Metadata = { title: "Solicitudes" };

export default async function PaginaSolicitudes() {
  await requerirUsuario("deposito.mover");
  const [pendientes, resueltas] = await Promise.all([
    solicitudes({ estado: "PENDIENTE" }),
    solicitudes({ estado: { not: "PENDIENTE" }, resueltaEn: { gte: new Date(Date.now() - 7 * 86400000) } }, 30),
  ]);
  return (
    <div className="mx-auto max-w-3xl">
      <Titulo detalle="Lo que piden y devuelven las obras.">Solicitudes</Titulo>
      {pendientes.length === 0 ? (
        <Vacio titulo="Nada pendiente" />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {pendientes.map((s) => <SolicitudDeposito key={s.id} s={s} />)}
        </ul>
      )}
      {resueltas.length > 0 && (
        <>
          <Subtitulo>Resueltas esta semana</Subtitulo>
          <ul className="grid gap-3 lg:grid-cols-2">
            {resueltas.reverse().map((s) => <SolicitudObra key={s.id} s={s} />)}
          </ul>
        </>
      )}
    </div>
  );
}
