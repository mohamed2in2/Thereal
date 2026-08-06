import { NextRequest, NextResponse } from "next/server";
import { getStudentSession } from "@/lib/auth";
import { generateIQReport } from "@/lib/ai-caller";
import type { IQReportInput } from "@/lib/ai-caller";
import { prisma } from "@/lib/prisma";

const SUBJECT_AR: Record<string, string> = {
  math:       "الرياضيات",
  physics:    "الفيزياء",
  chemistry:  "الكيمياء",
  biology:    "الأحياء",
  history:    "التاريخ",
  geography:  "الجغرافيا",
  languages:  "اللغات",
  coding:     "البرمجة",
};

export async function POST(req: NextRequest) {
  try {
    const session = await getStudentSession();
    if (!session) {
      return NextResponse.json({ error: "غير مصرح. يرجى تسجيل الدخول أولاً." }, { status: 401 });
    }

    const studentName = session.name;

    const body = await req.json() as Partial<IQReportInput> & { subject?: string };

    if (!body.subject || !body.totalQuestions) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Rate Limit: Max 5 reports per hour
    const oneHourAgo = new Date(Date.now() - 3600000);
    const recentReports = await prisma.activityLog.count({
      where: {
        adminId: session.id,
        action: "GENERATE_IQ_REPORT",
        createdAt: { gte: oneHourAgo },
      },
    });

    if (recentReports >= 5) {
      return NextResponse.json(
        { error: "لقد تجاوزت الحد الأقصى لإنشاء التقارير (5 تقارير في الساعة)." },
        { status: 429 }
      );
    }

    const input: IQReportInput = {
      studentName,
      subject:        body.subject,
      subjectAr:      SUBJECT_AR[body.subject] ?? body.subject,
      correctAnswers: body.correctAnswers ?? 0,
      totalQuestions: body.totalQuestions,
      avgTimeSec:     body.avgTimeSec ?? 10,
      maxLevel:       body.maxLevel ?? 5,
      maxStreak:      body.maxStreak ?? 0,
      difficulty:     body.difficulty ?? "medium",
      skills:         body.skills ?? {},
    };

    const report = await generateIQReport(input);

    // Write to ActivityLog to track rate limits
    await prisma.activityLog.create({
      data: {
        adminId: session.id,
        adminName: session.name,
        action: "GENERATE_IQ_REPORT",
        targetType: "IQ_REPORT",
        targetId: "self",
        targetName: "IQ Report",
        metadata: JSON.stringify({ subject: body.subject }),
      },
    }).catch((logErr) => {
      console.error("Failed to write IQ report activity log:", logErr);
    });

    return NextResponse.json({ report });
  } catch (err) {
    console.error("[IQ Report API]", err);
    // Return a static fallback so the UI never breaks
    return NextResponse.json({
      report: "أداء جيد! استمر في التدرب وسترى تحسناً ملحوظاً في مستواك. كل جلسة تمرين تبني مهاراتك خطوة بخطوة.",
    });
  }
}
