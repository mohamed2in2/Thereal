import type { NextConfig } from "next";

/**
 * Hosts the browser is allowed to talk to. Video is served from third-party
 * players inside iframes, so those hosts must be listed explicitly — a CSP that
 * blocks the player would break every lesson.
 */
const VIDEO_FRAME_HOSTS = [
  "https://www.youtube-nocookie.com",
  "https://www.youtube.com",
  "https://player.vdocipher.com",
  "https://iframe.mediadelivery.net",
  "https://*.b-cdn.net",
  "https://alasly.lovable.app",
];

const CSP = [
  "default-src 'self'",
  // Next.js injects inline bootstrap scripts; 'unsafe-inline' stays until a
  // nonce-based setup is introduced. Scripts still cannot be loaded from
  // arbitrary origins, which is what blocks injected exfiltration payloads.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.google.com https://www.gstatic.com https://www.youtube.com https://s.ytimg.com https://player.vdocipher.com",
  // Google Fonts is loaded from the root layout and the parent portal
  // (Tajawal / IBM Plex Sans Arabic / Amiri / Noto Naskh Arabic). Omitting
  // these two hosts blocks every Arabic webfont on the site.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "media-src 'self' blob: https:",
  `frame-src 'self' ${VIDEO_FRAME_HOSTS.join(" ")} https://www.google.com`,
  "connect-src 'self' https://recaptchaenterprise.googleapis.com https://www.google.com https://fonts.googleapis.com https://fonts.gstatic.com https://www.youtube.com https://www.youtube-nocookie.com https://*.googlevideo.com https://*.youtube.com",
  // Nothing in this app should ever be framed by a third party.
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@whiskeysockets/baileys"],
  productionBrowserSourceMaps: false,
  allowedDevOrigins: ["localhost", "127.0.0.1", "*.app.github.dev"],
  transpilePackages: ["framer-motion", "motion-dom", "motion-utils", "axios"],

  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000", "127.0.0.1:3000", "*.app.github.dev"],
    },
  },

  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "Content-Security-Policy", value: CSP },
        // Parent-portal links carry their token in the path, so the full URL
        // must never travel in a Referer header to a third-party host.
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=(), payment=(), display-capture=()",
        },
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
      ],
    },
    {
      // The parent portal is reached from a WhatsApp link; suppress the Referer
      // entirely so the token cannot leak to any outbound navigation.
      source: "/p/:token",
      headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
    },
  ],
};

export default nextConfig;
