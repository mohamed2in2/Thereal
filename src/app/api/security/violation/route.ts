import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const body = await req.json();
    const { type, videoId, details } = body as {
      type: string;
      videoId?: string;
      details?: string;
    };

    if (!type) {
      return NextResponse.json({ error: "نوع المخالفة مطلوب" }, { status: 400 });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    await prisma.securityViolation.create({
      data: {
        studentId: session.id,
        videoId: videoId || null,
        type,
        details: details || null,
        ip,
        userAgent,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to log security violation:", error);
    return NextResponse.json({ error: "خطأ داخلي" }, { status: 500 });
  }
}
