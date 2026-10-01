import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Solo desarrollo: permite abrir la app también en 127.0.0.1 (útil para probar dos sesiones a la vez).
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
