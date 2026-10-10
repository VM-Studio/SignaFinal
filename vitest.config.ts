import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  // JSX como en Next (el PDF de la OC es un componente de React).
  esbuild: { jsx: "automatic" },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // .env (DATABASE_URL) para las pruebas que usan la base, como la numeración de OC en paralelo.
  test: { include: ["src/**/*.test.ts"], environment: "node", env: loadEnv("test", process.cwd(), "") },
});
