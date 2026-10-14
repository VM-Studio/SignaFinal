import Image from "next/image";
import { SplashControl } from "./splash-control";
import { CLAVE_INGRESO, CLAVE_SPLASH, SPLASH_MS } from "./claves";

/**
 * Pantalla de carga: negra, logo grande al centro, barra del ancho del logo y el porcentaje.
 * Se ve al abrir el sistema (una vez por sesión) y cada vez que alguien ingresa.
 * Se renderiza en el servidor (es lo primero que se pinta) y un script en <head>
 * la oculta antes de pintar si no corresponde mostrarla.
 */
export function Splash() {
  return (
    <div id="splash" role="status" aria-label="Cargando SIGNA" className="fixed inset-0 z-[100] flex items-center justify-center bg-negro px-6">
      <div className="flex w-[min(62vw,250px)] flex-col items-center">
        {/* Logo limpio (public/marca/signa.png, transparente): archivo estático chico, sin pasar por el optimizador
            de imágenes, así aparece en el primer pintado aunque el servidor recién arranque. */}
        <Image src="/marca/signa.png" alt="SIGNA" width={1042} height={278} priority unoptimized draggable={false} className="h-auto w-full select-none" />
        <div className="mt-7 h-[2px] w-full overflow-hidden bg-white/15">
          <div id="splash-barra" className="h-full w-full origin-left bg-white" style={{ transform: "scaleX(0)" }} />
        </div>
        <p id="splash-porcentaje" className="mt-2.5 text-xs font-medium tracking-wider text-white/55 tabular-nums" aria-live="off">
          0%
        </p>
      </div>
      <SplashControl ms={SPLASH_MS} />
    </div>
  );
}

/** Oculta el splash antes de pintar si ya se vio y no se acaba de ingresar. */
export const scriptSplash = `try{var s=sessionStorage;if(s.getItem("${CLAVE_SPLASH}")==="1"&&!(s.getItem("${CLAVE_INGRESO}")==="1"&&location.pathname!=="/login"))document.documentElement.classList.add("splash-visto")}catch(e){}`;
