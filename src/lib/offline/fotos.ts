"use client";

/**
 * Achica una foto en el teléfono antes de mandarla: lado mayor 1280 px, JPEG 70%.
 * Una foto de 4 MB queda en ~150-250 KB: viaja rápido y entra en la cola sin señal.
 */
export async function comprimirFoto(archivo: File, ladoMax = 1280, calidad = 0.7): Promise<string> {
  if (archivo.type === "application/pdf") {
    return new Promise((ok, mal) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result));
      r.onerror = () => mal(new Error("No se pudo leer el archivo."));
      r.readAsDataURL(archivo);
    });
  }
  const bitmap = await createImageBitmap(archivo);
  const escala = Math.min(1, ladoMax / Math.max(bitmap.width, bitmap.height));
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(bitmap.width * escala);
  lienzo.height = Math.round(bitmap.height * escala);
  lienzo.getContext("2d")!.drawImage(bitmap, 0, 0, lienzo.width, lienzo.height);
  bitmap.close();
  return lienzo.toDataURL("image/jpeg", calidad);
}
