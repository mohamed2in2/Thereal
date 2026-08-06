import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

const ALLOWED_TYPES = ["error", "warning", "unhandled_promise", "api_error"] as const;
const MAX_MESSAGE_LEN = 1000;
const MAX_STACK_LEN = 4000;
const MAX_URL_LEN = 500;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      type?: string;
      message?: string;
      stack?: string;
      url?: string;
    };

    const type = ALLOWED_TYPES.includes(body.type as (typeof ALLOWED_TYPES)[number])
      ? body.type!
      : "error";
    const message = String(body.message ?? "").slice(0, MAX_MESSAGE_LEN).trim();
    if (!message) return NextResponse.json({ ok: false }, { status: 400 });

    const stack = body.stack ? String(body.stack).slice(0, MAX_STACK_LEN) : null;
    const url = body.url ? String(body.url).slice(0, MAX_URL_LEN) : null;
    const userAgent = req.headers.get("user-agent")?.slice(0, 300) ?? null;

    // Attach user identity if a session exists (best-effort, never blocks)
    let userId: string | null = null;
    let userRole: string | null = null;
    try {
      const session = await getSession();
      if (session) {
        userId = session.id ?? null;
        userRole = session.role ?? null;
      }
    } catch {
      // intentionally swallowed — session failure must not block error reporting
    }

    await prisma.clientError.create({
      data: { type, message, stack, url, userAgent, userId, userRole },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
