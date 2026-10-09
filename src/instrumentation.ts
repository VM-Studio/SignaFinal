/** Al arrancar el servidor: si faltan las claves de avisos push, que se vea claro en los logs. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const faltan = [
    !(process.env.VAPID_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) && "VAPID_PUBLIC_KEY",
    !process.env.VAPID_PRIVATE_KEY && "VAPID_PRIVATE_KEY",
    !process.env.VAPID_SUBJECT && "VAPID_SUBJECT",
    !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
  ].filter(Boolean);
  if (faltan.length) console.error(`AVISOS PUSH APAGADOS: faltan ${faltan.join(", ")} en el entorno. Ver docs/pendientes.md.`);
}
