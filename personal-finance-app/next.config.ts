import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactCompiler: true,
  // En dev, Next bloquea los assets /_next/* pedidos desde orígenes que no sean
  // localhost. El E2E en Docker entra por el alias del contenedor (cuotapp:3000),
  // así que hay que permitirlo o la página nunca hidrata. No afecta producción.
  allowedDevOrigins: ["cuotapp", "cuotapp:3000"],
};

export default nextConfig;
