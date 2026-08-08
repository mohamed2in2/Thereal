import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@whiskeysockets/baileys"],
  productionBrowserSourceMaps: false,
  allowedDevOrigins: ["localhost", "127.0.0.1", "*.app.github.dev"],

  turbopack: {
    root: process.cwd(),
  },

  experimental: {
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
