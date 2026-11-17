import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `/simple` fue la versión en texto. La portada ya lleva todo el contenido
  // en el HTML servido, y los enlaces compartidos tienen que seguir llegando.
  async redirects() {
    return [{ source: "/simple", destination: "/", permanent: true }];
  },
};

export default nextConfig;
