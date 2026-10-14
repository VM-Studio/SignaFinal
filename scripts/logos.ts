/**
 * LOGOS LIMPIOS para fondo negro (login y pantalla de carga), a partir de public/signalogo.png:
 * recortados al logo, con fondo transparente (la luminosidad pasa a ser la opacidad del blanco: el gris
 * de las franjas queda gris sobre negro) y en 2x/3x para que se vean nítidos.
 *
 *   npx tsx scripts/logos.ts
 */
import sharp from "sharp";

async function transparente(origen: string, recorte: { left: number; top: number; width: number; height: number }, ancho: number, destino: string) {
  const { data, info } = await sharp(origen).extract(recorte).resize({ width: ancho }).greyscale().raw().toBuffer({ resolveWithObject: true });
  const rgba = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0; i < info.width * info.height; i++) {
    // Negro del fondo (con ruido de compresión) → transparente; el resto, blanco con esa opacidad.
    const l = data[i];
    const a = l < 18 ? 0 : Math.min(255, Math.round(((l - 18) / (255 - 18)) * 255));
    rgba.set([255, 255, 255, a], i * 4);
  }
  await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } }).trim().png({ compressionLevel: 9, palette: false }).toFile(destino);
  const m = await sharp(destino).metadata();
  console.log(destino, `${m.width}×${m.height}`);
}

(async () => {
  // signalogo.png (2048 × 768): todo el logo con "Cultura en desarrollos".
  await transparente("public/signalogo.png", { left: 60, top: 60, width: 1940, height: 640 }, 1200, "public/marca/signa-completo.png");
  // Sin la bajada (pantalla de carga): símbolo + SIGNA, de public/loading.png (1672 × 941).
  await transparente("public/loading.png", { left: 400, top: 310, width: 910, height: 275 }, 1100, "public/marca/signa.png");
})();
