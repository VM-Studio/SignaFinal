import Image from "next/image";
import { SplashControl } from "./splash-control";
import { CLAVE_INGRESO, CLAVE_SPLASH, SPLASH_MS } from "./claves";

// Recorte del logo dentro de public/loading.png (1672 × 941): x 423–1284, y 332–561.
const IMG = { ancho: 1672, alto: 941 };
const LOGO = { x: 423, y: 332, ancho: 861, alto: 229 };

/**
 * Pantalla de carga: negra, logo grande al centro, barra del ancho del logo y el porcentaje.
 * Se ve al abrir el sistema (una vez por sesión) y cada vez que alguien ingresa.
 * Se renderiza en el servidor (es lo primero que se pinta) y un script en <head>
 * la oculta antes de pintar si no corresponde mostrarla.
 */
export function Splash() {
  return (
    <div id="splash" role="status" aria-label="Cargando SIGNA" className="fixed inset-0 z-[100] flex items-center justify-center bg-negro px-6">
      <div className="flex w-[min(84vw,560px)] flex-col items-center">
        <div className="relative w-full overflow-hidden" style={{ aspectRatio: `${LOGO.ancho} / ${LOGO.alto}` }}>
          <Image
            src="/loading.png"
            alt="SIGNA"
            width={IMG.ancho}
            height={IMG.alto}
            priority
            sizes="(min-width: 680px) 1100px, 170vw"
            className="absolute max-w-none"
            style={{
              width: `${(IMG.ancho / LOGO.ancho) * 100}%`,
              left: `${(-LOGO.x / LOGO.ancho) * 100}%`,
              top: `${(-LOGO.y / LOGO.alto) * 100}%`,
            }}
          />
        </div>
        <div className="mt-10 h-[3px] w-full overflow-hidden bg-white/15">
          <div id="splash-barra" className="h-full w-full origin-left bg-white" style={{ transform: "scaleX(0)" }} />
        </div>
        <p id="splash-porcentaje" className="mt-3 text-sm font-semibold tracking-wider text-white/75 tabular-nums" aria-live="off">
          0%
        </p>
      </div>
      <SplashControl ms={SPLASH_MS} />
    </div>
  );
}

/** Oculta el splash antes de pintar si ya se vio y no se acaba de ingresar. */
export const scriptSplash = `try{var s=sessionStorage;if(s.getItem("${CLAVE_SPLASH}")==="1"&&!(s.getItem("${CLAVE_INGRESO}")==="1"&&location.pathname!=="/login"))document.documentElement.classList.add("splash-visto")}catch(e){}`;
