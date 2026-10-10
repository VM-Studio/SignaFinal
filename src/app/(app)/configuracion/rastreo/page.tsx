import type { Metadata } from "next";
import { AlertTriangle, SatelliteDish } from "lucide-react";
import { exigirPermiso } from "@/lib/auth/sesion";
import { db } from "@/lib/db";
import { modoCusat } from "@/lib/cusat";
import { vapidFaltantes } from "@/lib/notificaciones";
import { CLAVE, leerEstado, type SinEnlazar, type UltimaSync, type UltimoError } from "@/lib/cusat/estado";
import { cuando, haceSeg } from "@/lib/formato";
import { Cifra, Insignia, Subtitulo, Tarjeta, Titulo } from "@/components/ui/basicos";
import { BotonesRastreo, EnlazarUnidad } from "@/components/configuracion/rastreo";

export const metadata: Metadata = { title: "Rastreo" };
export const dynamic = "force-dynamic";

/** Más que esto sin sincronizar: el cron no está corriendo. */
const SYNC_VIEJA_MS = 5 * 60_000;

/** Configuración → Rastreo: estado de la conexión con Cusat, prueba, sincronización y emparejamientos. */
export default async function PaginaRastreo() {
  await exigirPermiso("rastreo.configurar");
  const [sync, error, sin, vehiculos] = await Promise.all([
    leerEstado<UltimaSync>(CLAVE.ultimaSync),
    leerEstado<UltimoError>(CLAVE.ultimoError),
    leerEstado<SinEnlazar>(CLAVE.sinEnlazar),
    db.vehiculo.findMany({ where: { activo: true }, orderBy: [{ tipo: "asc" }, { nombre: "asc" }], select: { id: true, nombre: true, patente: true, idCusat: true, cusatNombre: true, ultimaFechaGps: true } }),
  ]);
  const modo = modoCusat();
  const enlazados = vehiculos.filter((v) => v.idCusat);
  const sinEnlazar = sin?.valor ?? [];
  const vieja = !sync || Date.now() - new Date(sync.valor.fecha).getTime() > SYNC_VIEJA_MS;
  const errorReciente = error && (!sync || new Date(error.valor.fecha) > new Date(sync.valor.fecha));
  const libres = vehiculos.filter((v) => !v.idCusat).map((v) => ({ id: v.id, nombre: `${v.nombre} · ${v.patente}` }));

  return (
    <div>
      <Titulo siempre detalle="Cusat View (Suartec). La posición de cada vehículo sale de acá; si Cusat no responde, del teléfono del chofer.">Rastreo</Titulo>

      {vapidFaltantes().length > 0 && (
        <p role="alert" className="mb-4 flex gap-2 rounded-[var(--radius-caja)] border border-critico/15 bg-critico-fondo p-3 font-semibold text-critico">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />
          Los avisos push están apagados: faltan {vapidFaltantes().join(", ")} en Vercel. Nadie recibe avisos en el celular.
        </p>
      )}
      {vieja && (
        <p className="mb-4 flex gap-2 rounded-[var(--radius-caja)] border border-aviso/15 bg-aviso-fondo p-3 font-semibold">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-aviso-texto" />
          {sync ? `El cron no está pegando. Revisá docs/cusat/cron.md (última sincronización ${haceSeg(sync.valor.fecha)}).` : "El cron no está pegando: todavía no hubo ninguna sincronización. Revisá docs/cusat/cron.md o tocá \"Sincronizar ahora\"."}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Cifra etiqueta="Modo" valor={modo === "cusatview" ? "Cusat" : "Simulado"} detalle={modo === "cusatview" ? "cusatglobal.com" : "CUSAT_MODO=mock"} />
        <Cifra etiqueta="Última sincronización" valor={sync ? haceSeg(sync.valor.fecha).replace("hace ", "") : "Nunca"} detalle={sync ? `${sync.valor.nuevas} posiciones nuevas · ${(sync.valor.ms / 1000).toFixed(1)} s` : undefined} tono={vieja ? "aviso" : "ok"} />
        {modo === "mock" ? (
          <Cifra etiqueta="Simulados" valor={vehiculos.length} detalle="todos los vehículos activos" />
        ) : (
          <Cifra etiqueta="Enlazados" valor={enlazados.length} detalle={`de ${vehiculos.length} vehículos`} tono={enlazados.length ? "ok" : "aviso"} />
        )}
        <Cifra etiqueta="Sin enlazar" valor={sinEnlazar.length} detalle="unidades de Cusat" />
      </div>
      {error && (
        <Tarjeta className={`mt-3 p-4 ${errorReciente ? "border-critico/30" : ""}`}>
          <p className="etiqueta">Último error {errorReciente ? "" : "(ya se resolvió)"}</p>
          <p className="mt-1 font-medium">{error.valor.error}</p>
          <p className="text-sm text-suave">{cuando(error.valor.fecha)}</p>
        </Tarjeta>
      )}

      <div className="mt-4"><BotonesRastreo /></div>

      <Subtitulo>Vehículos de la flota</Subtitulo>
      <ul className="divide-y divide-linea overflow-hidden rounded-[var(--radius-caja)] border border-linea bg-papel">
        {vehiculos.map((v) => (
          <li key={v.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{v.nombre} <span className="font-normal text-suave">· {v.patente}</span></p>
              <p className="text-sm text-suave">{v.idCusat ? `Cusat: ${v.cusatNombre ?? "?"} (unidad ${v.idCusat})${v.ultimaFechaGps ? ` · reportó ${haceSeg(v.ultimaFechaGps)}` : ""}` : modo === "mock" ? `Simulado · en Cusat se llama "${v.cusatNombre ?? "?"}"` : "Sin equipo de Cusat enlazado"}</p>
            </div>
            {v.idCusat ? <EnlazarUnidad idExterno={v.idCusat} desenlazar /> : modo === "cusatview" && <Insignia tono="neutro">Sin enlazar</Insignia>}
          </li>
        ))}
      </ul>

      <Subtitulo>Vehículos de Cusat sin enlazar</Subtitulo>
      {sinEnlazar.length === 0 ? (
        <Tarjeta className="flex items-center gap-3 p-4 text-suave"><SatelliteDish className="size-5" /> {sync ? "Todas las unidades de Cusat están enlazadas." : "Aparecen después de sincronizar."}</Tarjeta>
      ) : (
        <ul className="divide-y divide-linea overflow-hidden rounded-[var(--radius-caja)] border border-linea bg-papel">
          {sinEnlazar.map((u) => (
            <li key={u.idExterno} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{u.nombre} <span className="font-normal text-suave">· {u.patente}</span></p>
                <p className="text-sm text-suave">Unidad {u.idExterno} · reportó {haceSeg(u.fechaGps)}</p>
              </div>
              <EnlazarUnidad idExterno={u.idExterno} vehiculos={libres} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
