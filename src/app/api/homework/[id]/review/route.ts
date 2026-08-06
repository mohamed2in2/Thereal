import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/homework/[id]/review
 * Teacher manually accepts or rejects a flagged (review_requested) submission.
 * Body: { submissionId: string, verdict: "passed" | "failed", note?: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "teacher")
    return NextResponse.json({ error: "غير مصرح — فقط المعلمون" }, { status: 403 });

  const { id: homeworkId } = await params;

  // Verify homework belongs to this teacher
  const hw = await prisma.homework.findUnique({
    where: { id: homeworkId },
    select: { teacherId: true },
  });

  if (!hw) return NextResponse.json({ error: "الواجب غير موجود" }, { status: 404 });
  if (hw.teacherId !== session.id)
    return NextResponse.json({ error: "هذا الواجب لا ينتمي إليك" }, { status: 403 });

  const body = (await req.json()) as {
    submissionId: string;
    verdict: "passed" | "failed";
    note?: string;
  };

  if (!body.submissionId || !["passed", "failed"].includes(body.verdict))
    return NextResponse.json({ error: "بيانات غير صحيحة" }, { status: 400 });

  // Verify the submission belongs to this homework
  const submissionRecord = await prisma.homeworkSubmission.findUnique({
    where: { id: body.submissionId },
    select: { homeworkId: true },
  });

  if (!submissionRecord) {
    return NextResponse.json({ error: "التسليم غير موجود" }, { status: 404 });
  }
  if (submissionRecord.homeworkId !== homeworkId) {
    return NextResponse.json({ error: "التسليم لا يتطابق مع الواجب المحدد" }, { status: 400 });
  }

  // Update submission status
  const submission = await prisma.homeworkSubmission.update({
    where: { id: body.submissionId },
    data: { status: body.verdict },
  });

  // Upsert review record
  const review = await prisma.homeworkReview.upsert({
    where: { submissionId: body.submissionId },
    create: {
      submissionId: body.submissionId,
      teacherId: session.id,
      verdict: body.verdict,
      note: body.note ?? null,
      reviewedAt: new Date(),
    },
    update: {
      verdict: body.verdict,
      note: body.note ?? null,
      reviewedAt: new Date(),
    },
  });

  return NextResponse.json({ submission, review });
}

/**
 * GET /api/homework/[id]/review
 * Returns all review_requested + pending submissions for this homework (teacher view).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "teacher")
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  const { id: homeworkId } = await params;

  const hw = await prisma.homework.findUnique({
    where: { id: homeworkId },
    select: { teacherId: true, title: true, expectedOutput: true, type: true },
  });

  if (!hw || hw.teacherId !== session.id)
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  const submissions = await prisma.homeworkSubmission.findMany({
    where: { homeworkId, status: { in: ["review_requested", "pending"] } },
    include: {
      student: { select: { id: true, name: true, email: true } },
      review: true,
    },
    orderBy: { completedAt: "desc" },
  });

  return NextResponse.json({ hw, submissions });
}
