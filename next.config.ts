import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  productionBrowserSourceMaps: false,
  allowedDevOrigins: ["localhost", "127.0.0.1", "*.app.github.dev"],

  // Turbopack (default in Next.js 16) — empty object opts in cleanly
  // and suppresses the "webpack config but no turbopack config" error.
  turbopack: {},

  experimental: {
    optimizePackageImports: [
      "framer-motion",
      "react",
      "react-dom",
    ],
    serverActions: {
      allowedOrigins: ["localhost:3000", "127.0.0.1:3000", "*.app.github.dev"],
    },
  },

  headers: async () => [
    {
      source: "/(.*)",
      headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }],
    },
  ],
};

export default nextConfig;
