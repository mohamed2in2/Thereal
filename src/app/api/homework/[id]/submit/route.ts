import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { evaluateTerminalWithAI } from "@/lib/ai-service";
import { checkHomeworkAccess } from "@/lib/authorization";
import path from "path";
import fs from "fs/promises";
import {
  canAccessContent,
  ContentType,
  recordContentCompleted,
} from "@/lib/content-access-engine";

/** Normalize output: collapse whitespace, trim lines, lowercase */
function normalizeOutput(s: string): string {
  return s
    .split("\n")
    .map((l) => l.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
}

/** POST /api/homework/[id]/submit */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "student")
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  const { id: homeworkId } = await params;

  const hw = await prisma.homework.findUnique({
    where: { id: homeworkId },
    include: { questions: { orderBy: { order: "asc" } } },
  });

  if (!hw || !hw.isPublished)
    return NextResponse.json({ error: "الواجب غير موجود" }, { status: 404 });

  if (hw.dueAt && new Date() > hw.dueAt) {
    return NextResponse.json({ error: "انتهى موعد تسليم الواجب" }, { status: 400 });
  }

  // Enforce enrollment validation
  const hasAccess = await checkHomeworkAccess(session.id, session.role, homeworkId);
  if (!hasAccess) {
    return NextResponse.json({ error: "غير مصرح لك بالوصول لهذا الواجب" }, { status: 403 });
  }

  const access = await canAccessContent(session.id, {
    type: ContentType.HOMEWORK,
    sourceId: homeworkId,
    title: hw.title,
  });
  if ("requiredItem" in access) {
    return NextResponse.json(
      {
        error: `يجب إكمال «${access.requiredItem.title}» أولًا.`,
        code: access.code,
        requiredItem: access.requiredItem,
      },
      { status: 403 }
    );
  }

  // Prevent re-submission
  const existing = await prisma.homeworkSubmission.findUnique({
    where: { homeworkId_studentId: { homeworkId, studentId: session.id } },
  });
  if (existing)
    return NextResponse.json(
      { error: "لقد أرسلت هذا الواجب بالفعل", alreadySubmitted: true, submission: existing },
      { status: 409 }
    );

  const body = (await req.json()) as {
    submittedOutput?: string; // terminal
    fileUrl?: string;         // upload
    fileName?: string;        // upload
    answers?: Record<string, string>; // MCQ: { questionId: "A"|"B"|"C"|"D" }
  };

  let status = "pending";
  let score: number | null = null;
  let totalQ: number | null = null;

  // ── Terminal ──────────────────────────────────────────────────────────────
  if (hw.type === "terminal") {
    if (!body.submittedOutput?.trim())
      return NextResponse.json({ error: "يجب إدخال الناتج" }, { status: 400 });

    const expected = normalizeOutput(hw.expectedOutput ?? "");
    const submitted = normalizeOutput(body.submittedOutput);

    if (submitted === expected) {
      status = "passed";
    } else {
      // AI semantic fallback
      try {
        const aiResult = await evaluateTerminalWithAI(
          hw.codeTemplate ?? "",
          body.submittedOutput,
          hw.expectedOutput ?? "",
          hw.codeLanguage ?? "python"
        );
        status = aiResult.passed ? "passed" : "failed";
      } catch {
        // AI unavailable → flag for manual review
        status = "review_requested";
      }
    }
  }

  // ── Upload ────────────────────────────────────────────────────────────────
  else if (hw.type === "upload") {
    if (!body.fileUrl)
      return NextResponse.json({ error: "يجب رفع ملف أولاً" }, { status: 400 });
    status = "pending"; // teacher reviews manually
  }

  // ── Exam (MCQ) ────────────────────────────────────────────────────────────
  else if (hw.type === "exam") {
    if (!body.answers || Object.keys(body.answers).length === 0)
      return NextResponse.json({ error: "يجب الإجابة على الأسئلة" }, { status: 400 });

    const questions = hw.questions;
    let correct = 0;
    for (const q of questions) {
      if (body.answers[q.id] === q.correctAnswer) correct++;
    }
    totalQ = questions.length;
    score = totalQ > 0 ? Math.round((correct / totalQ) * 100) : 0;
    status = score >= 50 ? "passed" : "failed";
  }

  // ── Link (no submission needed) ───────────────────────────────────────────
  else {
    return NextResponse.json({ error: "هذا الواجب لا يحتاج إرسال" }, { status: 400 });
  }

  let submission;
  try {
    submission = await prisma.$transaction(async (tx) => {
      const savedSubmission = await tx.homeworkSubmission.create({
        data: {
          homeworkId,
          studentId:       session.id,
          answers:         body.answers ? JSON.stringify(body.answers) : null,
          score,
          totalQ,
          submittedOutput: body.submittedOutput ?? null,
          fileUrl:         body.fileUrl ?? null,
          fileName:        body.fileName ?? null,
          status,
        },
      });
      await recordContentCompleted(
        session.id,
        { type: ContentType.HOMEWORK, sourceId: homeworkId, title: hw.title },
        { score, completedAt: savedSubmission.completedAt },
        tx
      );
      return savedSubmission;
    });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "لقد أرسلت هذا الواجب بالفعل", alreadySubmitted: true }, { status: 409 });
    }
    throw error;
  }

  return NextResponse.json({ submission, status });
}

/** GET /api/homework/[id]/submit — student checks their own submission (teachers/admins check query param) */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { id: homeworkId } = await params;

  const hasAccess = await checkHomeworkAccess(session.id, session.role, homeworkId);
  if (!hasAccess) {
    return NextResponse.json({ error: "غير مصرح لك بالوصول لهذا الواجب" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const targetStudentId = (session.role === "teacher" || session.role === "admin" || session.role === "superadmin")
    ? (searchParams.get("studentId") ?? session.id)
    : session.id;

  const submission = await prisma.homeworkSubmission.findUnique({
    where: { homeworkId_studentId: { homeworkId, studentId: targetStudentId } },
    include: { review: true },
  });

  return NextResponse.json({ submission });
}
