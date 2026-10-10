/** Un adjunto (PDF o imagen) a la vista, sin salir de la pantalla: para transcribir mirándolo. */
export function VisorAdjunto({ id, nombre, tipo }: { id: string; nombre: string; tipo: string }) {
  return tipo.startsWith("image/") ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/api/adjuntos/${id}`} alt={nombre} className="w-full rounded-md border border-linea" />
  ) : (
    <iframe src={`/api/adjuntos/${id}`} title={nombre} className="h-[70dvh] w-full rounded-md border border-linea bg-fondo" />
  );
}
