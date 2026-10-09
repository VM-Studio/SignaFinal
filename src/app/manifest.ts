import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Signa",
    short_name: "Signa",
    description: "Pedidos de viaje, flota y depósito de Signa Desarrollos.",
    start_url: "/inicio",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    lang: "es-AR",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Pedir un viaje", url: "/pedir", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Avisos", url: "/avisos", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Escanear herramienta", url: "/herramientas/escanear", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
