import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // sharp e @napi-rs/canvas usam binários nativos — não devem ser bundlados
  // pelo empacotador do Next, só copiados como estão (usados pelo Clonador
  // de Carrossel em src/lib/carousel).
  serverExternalPackages: ["sharp", "@napi-rs/canvas"],
};

export default nextConfig;
