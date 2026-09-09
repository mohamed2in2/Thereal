import { NextRequest, NextResponse } from "next/server";

/**
 * Global security-headers middleware.
 *
 * Every response — page, API route, static asset — receives a baseline
 * set of defence-in-depth headers. None of these headers break existing
 * functionality; they only restrict what a browser is permitted to do.
 *
 * Adjust the CSP `script-src` and `connect-src` directives when you add
 * new third-party scripts or API origins.
 */
export function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // ── Clickjacking protection ────────────────────────────────────────────────
  // Prevents the app from being embedded in an <iframe> on a foreign origin.
  res.headers.set("X-Frame-Options", "DENY");

  // ── MIME-type sniffing protection ──────────────────────────────────────────
  // Forces the browser to honour the declared Content-Type instead of
  // guessing — prevents content-injection via uploaded files served inline.
  res.headers.set("X-Content-Type-Options", "nosniff");

  // ── Referrer leakage control ───────────────────────────────────────────────
  // Sends the full URL only to same-origin requests; cross-origin requests
  // receive only the origin (no path, no query string).
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // ── Browser-feature gating ─────────────────────────────────────────────────
  // Disables sensors and APIs that the app does not intentionally use.
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=()"
  );

  // ── Content Security Policy ────────────────────────────────────────────────
  // Restricts which origins may load scripts, styles, fonts, and data.
  // 'unsafe-inline' is required for Next.js inline styles; tighten with
  // nonce-based CSP once Next.js nonce support is wired in.
  //
  // Extend connect-src with any additional API / CDN domains your app calls.
  const isDev = process.env.NODE_ENV === "development";
  const csp = [
    "default-src 'self'",
    // Next.js requires 'unsafe-inline' for its runtime style injection.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    // 'unsafe-eval' is needed only during local development (HMR).
    isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
      : "script-src 'self' 'unsafe-inline'",
    // Add your CDN / Supabase / Bunny hostnames here.
    "connect-src 'self' https://*.supabase.co https://*.b-cdn.net wss:",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ");

  res.headers.set("Content-Security-Policy", csp);

  // ── HSTS (HTTP Strict Transport Security) ─────────────────────────────────
  // Only set over HTTPS. Tells browsers to always use HTTPS for this
  // origin for the next year, including sub-domains.
  if (process.env.NODE_ENV === "production") {
    res.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }

  return res;
}

/**
 * Run the middleware on every route except Next.js internals and static files.
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static  (compiled assets)
     * - _next/image   (image optimisation pipeline)
     * - favicon.ico
     * - public folder image/font files
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
