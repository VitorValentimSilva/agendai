import type { NextConfig } from "next";

const API_URL = (process.env.API_URL ?? "http://localhost:3001").replace(/\/$/, "");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  /**
   * O navegador fala só com o Next. `/api/*` é encaminhado para a API, então o
   * cookie httpOnly da sessão fica no domínio do site (sem CORS nem cookie de terceiros).
   */
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/:path*` }];
  },
};

export default nextConfig;
