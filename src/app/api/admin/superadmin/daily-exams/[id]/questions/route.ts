import { logAdminAction } from "@/lib/admin-auth";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();

    if (session && session.role === "superadmin") {
      try {
        await logAdminAction({
          adminId: session.id,
          adminName: session.name,
          action: "SUPERADMIN_ACTION",
          targetType: "API_ROUTE",
          targetId: req.nextUrl ? req.nextUrl.pathname : req.url,
          targetName: req.method,
        });
      } catch (e) {}
    }
  if (!session || session.role !== "superadmin") {
    return NextResponse.json({ error: "غير مصرح لك" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const { question, optionA, optionB, optionC, optionD, correctAnswer, order } = await req.json();

    if (!question || !optionA || !optionB || !optionC || !optionD || !correctAnswer) {
      return NextResponse.json({ error: "جميع الحقول مطلوبة" }, { status: 400 });
    }

    const newQ = await prisma.dailyExamQuestion.create({
      data: {
        examId: id,
        question,
        optionA,
        optionB,
        optionC,
        optionD,
        correctAnswer,
        order: order || 0
      }
    });

    return NextResponse.json({ question: newQ });
  } catch (error) {
    console.error("Error creating question:", error);
    return NextResponse.json({ error: "حدث خطأ داخلي" }, { status: 500 });
  }
}
