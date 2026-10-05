import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Solo desarrollo: permite abrir la app también en 127.0.0.1.
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    // Fotos de remitos y tickets (ya comprimidas en el teléfono a ~200 KB).
    serverActions: { bodySizeLimit: "4mb" },
    // Volver a una pantalla ya vista en los últimos 30 s es instantáneo. Cada acción revalida
    // las listas y detalles de su módulo (src/lib/revalidar.ts): después de un cambio no se ve un dato viejo.
    staleTimes: { dynamic: 30 },
    // Íconos: importa solo los que se usan.
    optimizePackageImports: ["lucide-react", "date-fns"],
  },
};

export default nextConfig;
