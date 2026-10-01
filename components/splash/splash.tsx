import { SplashControl } from "./splash-control";

export const SPLASH_MS = 2500;
export const CLAVE_SPLASH = "signa:splash-visto";

/**
 * Pantalla de inicio. Se renderiza en el servidor para que sea lo primero que se ve,
 * y un script en <head> la oculta antes de pintar si ya se mostró en esta sesión.
 * Escritorio (horizontal ≥1024px): SignaInicioSistema. Celular / app: SignaInicioApp.
 */
export function Splash() {
  return (
    <div
      id="splash"
      role="status"
      aria-label="Cargando SIGNA"
      className="fixed inset-0 z-[100] bg-negro"
      style={{ ["--splash-ms" as string]: `${SPLASH_MS}ms` }}
    >
      <picture>
        <source media="(min-width: 1024px) and (orientation: landscape)" srcSet="/img/inicio-sistema.jpg" />
        <img
          src="/img/inicio-app.jpg"
          alt=""
          fetchPriority="high"
          decoding="sync"
          className="h-full w-full object-cover select-none"
          draggable={false}
        />
      </picture>
      <div className="absolute inset-x-0 bottom-[11%] flex justify-center">
        <div className="splash-barra h-[3px] w-48 overflow-hidden rounded-full bg-white/20 lg:w-64">
          <span className="block h-full w-full origin-left scale-x-0 bg-white" />
        </div>
      </div>
      <SplashControl ms={SPLASH_MS} clave={CLAVE_SPLASH} />
    </div>
  );
}

/** Script de <head>: si ya se vio en esta sesión, se oculta antes del primer pintado. */
export const scriptSplash = `try{if(sessionStorage.getItem("${CLAVE_SPLASH}")==="1")document.documentElement.classList.add("splash-visto")}catch(e){}`;
