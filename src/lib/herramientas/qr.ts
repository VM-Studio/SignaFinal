import "server-only";
import QRCode from "qrcode";
import { headers } from "next/headers";

/** URL que va en el QR: abre la ficha desde cualquier cámara (/h/SIG-0001). */
export async function urlDeCodigo(codigo: string) {
  const base = process.env.APP_URL ?? `${(await headers()).get("x-forwarded-proto") ?? "http"}://${(await headers()).get("host")}`;
  return `${base.replace(/\/$/, "")}/h/${encodeURIComponent(codigo)}`;
}

export async function svgQR(codigo: string) {
  return QRCode.toString(await urlDeCodigo(codigo), { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } });
}
