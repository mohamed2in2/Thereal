import { jwtVerify } from "jose";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Admin-panel sub-pages — require a valid session; redirect to /adminpanel on failure */
const ADMIN_PANEL_PREFIXES = [
  "/adminpanel/superadmin",
  "/adminpanel/teacher",
];

/** Student/user page routes — require a valid session; redirect to /login on failure */
const PROTECTED_PAGE_PREFIXES = [
  "/dashboard",
  "/library",
  "/quizzes",
  "/codes",
  "/complete-profile",
  "/account",
];

/** Protected API routes — require a valid session; return 401 JSON on failure */
const PROTECTED_API_PREFIXES = [
  "/api/library",
  "/api/quizzes",
  "/api/progress",
  "/api/auth/complete-profile",
];

/** Paths under /courses that require auth (the learning room) */
function isProtectedCourseRoute(pathname: string) {
  return /^\/courses\/[^/]+\/learn(\/.*)?$/.test(pathname);
}

function isProtectedPlanRoute(pathname: string) {
  return /^\/plans\/[^/]+\/learn(\/.*)?$/.test(pathname);
}

/** Public API routes under /api/courses that need no session */
function isPublicCoursesApi(pathname: string) {
  return pathname === "/api/courses" || /^\/api\/courses(\/[^/]+\/preview)?$/.test(pathname);
}

function isPublicPlansApi(pathname: string) {
  return pathname === "/api/plans" || /^\/api\/plans\/[^/]+$/.test(pathname);
}

function startsWithAny(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** /adminpanel login page itself — exact match only, never prefix */
function isAdminLoginPage(pathname: string) {
  return pathname === "/adminpanel" || pathname === "/adminpanel/";
}

// Read JWT_SECRET dynamically inside hasValidSession to handle hot-reloads and Edge runtime environment injection correctly.
async function hasValidSession(req: NextRequest) {
  const secretStr = process.env.JWT_SECRET;
  if (!secretStr) {
    console.warn("JWT_SECRET environment variable is missing in middleware context!");
    return false;
  }
  const token = req.cookies.get("auth_token")?.value;
  if (!token) {
    return false;
  }
  try {
    const secret = new TextEncoder().encode(secretStr);
    await jwtVerify(token, secret);
    return true;
  } catch (err: any) {
    return false;
  }
}

export default async function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // Forward the current path to server components (root layout reads this to
  // decide maintenance gating — middleware runs on Edge and can't touch the DB).
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", pathname);
  const pass = () => NextResponse.next({ request: { headers: requestHeaders } });

  if (pathname === "/") return pass();

  // Admin panel login page — always public
  if (isAdminLoginPage(pathname)) return pass();

  // Always allow public access to login and signup
  if (pathname.startsWith("/login") || pathname.startsWith("/signup")) {
    return pass();
  }

  const authed = await hasValidSession(req);

  // Admin sub-pages: redirect to /adminpanel login if no session
  if (startsWithAny(pathname, ADMIN_PANEL_PREFIXES) && !authed) {
    return NextResponse.redirect(new URL("/adminpanel", req.url));
  }

  // Learning room inside courses — auth required
  if (isProtectedCourseRoute(pathname) && !authed) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect_url", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Learning room inside plans — auth required
  if (isProtectedPlanRoute(pathname) && !authed) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect_url", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Protect /api/courses/* except public preview endpoint
  if (pathname.startsWith("/api/courses") && !isPublicCoursesApi(pathname) && !authed) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  // Protect /api/plans/* except public endpoints
  if (pathname.startsWith("/api/plans") && !isPublicPlansApi(pathname) && !authed) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  // Protect other API endpoints (return 401 JSON, NEVER redirect to /login HTML)
  if (startsWithAny(pathname, PROTECTED_API_PREFIXES) && !authed) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  // Protected page routes: redirect to /login if no session
  if (startsWithAny(pathname, PROTECTED_PAGE_PREFIXES) && !authed) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect_url", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return pass();
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
