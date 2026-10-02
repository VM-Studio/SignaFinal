"use client";

import { useActionState, useState } from "react";
import { ChevronDown, Eye, EyeOff } from "lucide-react";
import { ingresar, type EstadoLogin } from "@/lib/auth/acciones";
import { CLAVE_INGRESO } from "@/components/splash/claves";

type Demo = { usuarios: { nombre: string; email: string; rol: string }[]; contrasena: string } | null;

const campo =
  "w-full min-h-[52px] rounded-[var(--radius-caja)] border-2 border-white/20 bg-white/5 px-4 text-base text-white placeholder:text-white/40 focus:border-white focus:outline-none";

export function FormularioLogin({ volver, demo }: { volver?: string; demo: Demo }) {
  const [estado, accion, pendiente] = useActionState<EstadoLogin, FormData>(ingresar, undefined);
  const [email, setEmail] = useState(estado?.email ?? "");
  const [password, setPassword] = useState("");
  const [ver, setVer] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <form
        action={accion}
        // Al entrar se vuelve a mostrar la pantalla de carga.
        onSubmit={() => {
          try {
            sessionStorage.setItem(CLAVE_INGRESO, "1");
          } catch {}
        }}
        className="flex flex-col gap-4"
      >
        {volver && <input type="hidden" name="volver" value={volver} />}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-semibold text-white/80">Email</label>
          <input id="email" name="email" type="email" inputMode="email" autoComplete="username" autoCapitalize="none" required value={email} onChange={(e) => setEmail(e.target.value)} className={campo} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-semibold text-white/80">Contraseña</label>
          <div className="relative">
            <input id="password" name="password" type={ver ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={`${campo} pr-12`} />
            <button type="button" onClick={() => setVer(!ver)} aria-label={ver ? "Ocultar contraseña" : "Mostrar contraseña"} className="absolute top-0 right-0 grid h-[52px] w-12 place-items-center text-white/60">
              {ver ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          </div>
        </div>
        {estado?.error && (
          <p role="alert" className="rounded-[var(--radius-caja)] bg-critico px-4 py-3 font-medium text-white">
            {estado.error}
          </p>
        )}
        <button type="submit" disabled={pendiente} className="min-h-[56px] rounded-[var(--radius-caja)] bg-white text-lg font-bold text-negro disabled:opacity-60">
          {pendiente ? "Ingresando…" : "Ingresar"}
        </button>
      </form>

      {demo && (
        <details className="group rounded-[var(--radius-caja)] border border-white/15">
          <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between px-4 font-semibold text-white/80">
            Usuarios de demo
            <ChevronDown className="size-5 group-open:rotate-180" />
          </summary>
          <ul className="divide-y divide-white/10 border-t border-white/10">
            {demo.usuarios.map((u) => (
              <li key={u.email}>
                <button
                  type="button"
                  onClick={() => {
                    setEmail(u.email);
                    setPassword(demo.contrasena);
                  }}
                  className="flex min-h-[52px] w-full items-center justify-between gap-3 px-4 text-left hover:bg-white/5"
                >
                  <span className="font-semibold">{u.nombre}</span>
                  <span className="text-sm text-white/55">{u.rol}</span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
