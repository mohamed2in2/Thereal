import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { whatsappOrchestrator } from "@/lib/whatsapp/orchestrator";

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

    // Check violation count for student in last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentViolations = await prisma.securityViolation.count({
      where: {
        studentId: session.id,
        createdAt: { gte: twentyFourHoursAgo },
      },
    });

    // Notify parent via WhatsApp on threshold (e.g. 3, 6, 9 violations)
    if (recentViolations >= 3 && recentViolations % 3 === 0) {
      const student = await prisma.user.findUnique({
        where: { id: session.id },
        select: { name: true, parentPhone: true },
      });

      if (student?.parentPhone) {
        const alertMsg = `⚠️ تنبيه أمني عاجل من منصة Code-UP:\n\nنسترعي انتباهكم بأنه تم رصد محاولات متكررة لتصوير الشاشة أو فتح أدوات المطور (DevTools) أثناء مشاهدة الفيديوهات على حساب نجلك (${student.name}).\n\nيرجى التنبيه عليه لمنع حظر الحساب نهائياً من متابعة الدروس.`;

        whatsappOrchestrator
          .sendMessage({
            recipient: student.parentPhone,
            messageType: "NOTIFICATION",
            content: alertMsg,
          })
          .catch(() => {});
      }
    }

    return NextResponse.json({ success: true, count: recentViolations });
  } catch (error: any) {
    console.error("Failed to log security violation:", error);
    return NextResponse.json({ error: "خطأ داخلي" }, { status: 500 });
  }
}
