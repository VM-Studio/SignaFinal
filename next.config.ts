import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Solo desarrollo: permite abrir la app también en 127.0.0.1.
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    // Fotos de remitos y tickets (ya comprimidas en el teléfono a ~200 KB).
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
