import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `standalone` es para el Dockerfile de producción (camino VPS a futuro). En Vercel
  // NO va: rompe el wiring de rutas del App Router y devuelve 404 en todo. Vercel
  // expone VERCEL=1 en el build, así que ahí lo desactivamos.
  output: process.env.VERCEL ? undefined : "standalone",
  reactCompiler: true,
  // En dev, Next bloquea los assets /_next/* pedidos desde orígenes que no sean
  // localhost. El E2E en Docker entra por el alias del contenedor (cuotapp:3000),
  // así que hay que permitirlo o la página nunca hidrata. No afecta producción.
  allowedDevOrigins: ["cuotapp", "cuotapp:3000"],
};

export default nextConfig;
