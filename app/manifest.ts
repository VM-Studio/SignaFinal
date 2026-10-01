import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "SIGNA · Logística",
    short_name: "SIGNA",
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
      { src: "/icons/icon-384.png", sizes: "384x384", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Pedir un viaje", url: "/pedidos/nuevo", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Cola de pedidos", url: "/pedidos", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
