import Image from "next/image";
import { SplashControl } from "./splash-control";

export const SPLASH_MS = 1800;
export const CLAVE_SPLASH = "signa:splash-visto";

/**
 * Pantalla de inicio: negra, logo centrado y una barra blanca fina que avanza en 1,8 s.
 * Se renderiza en el servidor (es lo primero que se pinta) y un script en <head>
 * la oculta antes de pintar si ya se vio en esta sesión.
 */
export function Splash() {
  return (
    <div
      id="splash"
      role="status"
      aria-label="Cargando SIGNA"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-7 bg-negro"
      style={{ ["--splash-ms" as string]: `${SPLASH_MS}ms` }}
    >
      <Image src="/signalogo.png" alt="SIGNA · Cultura en desarrollos" width={180} height={68} priority className="h-auto w-[180px]" />
      <div className="h-[2px] w-[180px] overflow-hidden bg-white/15">
        <div className="splash-barra h-full w-full origin-left scale-x-0 bg-white" />
      </div>
      <SplashControl ms={SPLASH_MS} clave={CLAVE_SPLASH} />
    </div>
  );
}

export const scriptSplash = `try{if(sessionStorage.getItem("${CLAVE_SPLASH}")==="1")document.documentElement.classList.add("splash-visto")}catch(e){}`;
