import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
    // Vitest = unit/component (*.test.ts). Los E2E (*.spec.ts en e2e/) los corre Playwright.
    include: ["src/**/*.test.{ts,tsx}"],
    // El proyecto asume runtime UTC (ver docs/ARCHITECTURE.md → "Zona horaria del
    // runtime"). Fijamos TZ=UTC acá para que los guardias del invariante
    // (installment-status, dates) pasen sin importar la TZ de la máquina local —
    // en Vercel el runtime ya es UTC. Sin esto, en AR (UTC−3) fallan a propósito.
    env: { TZ: "UTC" },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
