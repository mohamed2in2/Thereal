import { NextRequest, NextResponse } from "next/server";
import { getSession, getStudentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkCourseEnrollment } from "@/lib/authorization";

const ALLOWED_TYPES = ["complaint", "question", "suggestion", "technical", "other"] as const;
const ALLOWED_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
const ALLOWED_STATUSES = ["open", "in_progress", "resolved", "closed", "escalated"] as const;

type TicketType = (typeof ALLOWED_TYPES)[number];
type TicketPriority = (typeof ALLOWED_PRIORITIES)[number];
type TicketStatus = (typeof ALLOWED_STATUSES)[number];

function isAllowedType(v: unknown): v is TicketType {
  return ALLOWED_TYPES.includes(v as TicketType);
}
function isAllowedPriority(v: unknown): v is TicketPriority {
  return ALLOWED_PRIORITIES.includes(v as TicketPriority);
}
function isAllowedStatus(v: unknown): v is TicketStatus {
  return ALLOWED_STATUSES.includes(v as TicketStatus);
}

// POST — student creates a support ticket
export async function POST(req: NextRequest) {
  try {
    const session = await getStudentSession();
    if (!session) return NextResponse.json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { title, description, type, priority, courseId } = body as {
      title?: unknown;
      description?: unknown;
      type?: unknown;
      priority?: unknown;
      courseId?: unknown;
    };

    // Required fields
    if (!title || typeof title !== "string" || title.trim().length < 5) {
      return NextResponse.json(
        { error: "\u0627\u0644\u0639\u0646\u0648\u0627\u0646 \u0645\u0637\u0644\u0648\u0628 (5 \u062D\u0631\u0648\u0641 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644)" },
        { status: 400 }
      );
    }
    if (title.length > 200) {
      return NextResponse.json(
        { error: "\u0627\u0644\u0639\u0646\u0648\u0627\u0646 \u0637\u0648\u064A\u0644 \u062C\u062F\u064B\u0627 (200 \u062D\u0631\u0641 \u0643\u062D\u062F \u0623\u0642\u0635\u0649)" },
        { status: 400 }
      );
    }

    if (!description || typeof description !== "string" || description.trim().length < 10) {
      return NextResponse.json(
        { error: "\u0627\u0644\u0648\u0635\u0641 \u0645\u0637\u0644\u0648\u0628 (10 \u062D\u0631\u0648\u0641 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644)" },
        { status: 400 }
      );
    }
    if (description.length > 5000) {
      return NextResponse.json(
        { error: "\u0627\u0644\u0648\u0635\u0641 \u0637\u0648\u064A\u0644 \u062C\u062F\u064B\u0627 (5000 \u062D\u0631\u0641 \u0643\u062D\u062F \u0623\u0642\u0635\u0649)" },
        { status: 400 }
      );
    }

    // Optional but validated when present
    const safeType: TicketType = isAllowedType(type) ? type : "other";
    const safePriority: TicketPriority = isAllowedPriority(priority) ? priority : "normal";

    const safeCourseId =
      courseId && typeof courseId === "string" && courseId.length > 0
        ? courseId
        : null;

    if (safeCourseId) {
      const isEnrolled = await checkCourseEnrollment(session.id, safeCourseId);
      if (!isEnrolled) {
        return NextResponse.json(
          { error: "\u063A\u064A\u0631 \u0645\u0633\u062C\u0644 \u0641\u064A \u0647\u0630\u0627 \u0627\u0644\u0643\u0648\u0631\u0633" },
          { status: 403 }
        );
      }
    }

    const ticket = await prisma.supportTicket.create({
      data: {
        studentId: session.id,
        courseId: safeCourseId,
        title: title.trim(),
        description: description.trim(),
        type: safeType,
        priority: safePriority,
        status: "open",
      },
    });

    return NextResponse.json({
      ticket,
      message: "\u062A\u0645 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u062A\u0630\u0643\u0631\u0629 \u0628\u0646\u062C\u0627\u062D",
    });
  } catch (err) {
    console.error("Tickets POST error:", err);
    return NextResponse.json({ error: "\u062D\u062F\u062B \u062E\u0637\u0623" }, { status: 500 });
  }
}

// GET — list tickets (student: own; teacher: their courses; admin: all)
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D" }, { status: 401 });

    const statusParam = req.nextUrl.searchParams.get("status");
    // Only pass status to Prisma when it's a known enum value
    const statusFilter: { status: TicketStatus } | Record<string, never> =
      statusParam && isAllowedStatus(statusParam)
        ? { status: statusParam }
        : {};

    if (session.role === "student") {
      const tickets = await prisma.supportTicket.findMany({
        where: { studentId: session.id, ...statusFilter },
        orderBy: { createdAt: "desc" },
        include: { course: { select: { title: true } } },
      });
      return NextResponse.json({ tickets });
    }

    if (session.role === "teacher") {
      const courses = await prisma.course.findMany({
        where: { teacherId: session.id },
        select: { id: true },
      });
      const tickets = await prisma.supportTicket.findMany({
        where: {
          courseId: { in: courses.map((c) => c.id) },
          ...statusFilter,
        },
        orderBy: { createdAt: "desc" },
        include: {
          student: { select: { name: true, phone: true } },
          course: { select: { title: true } },
        },
      });
      return NextResponse.json({ tickets });
    }

    if (session.role === "superadmin" || session.role === "admin") {
      const tickets = await prisma.supportTicket.findMany({
        where: { ...statusFilter },
        orderBy: { createdAt: "desc" },
        include: {
          student: { select: { name: true, phone: true } },
          course: { select: { title: true } },
        },
      });
      return NextResponse.json({ tickets });
    }

    return NextResponse.json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D" }, { status: 403 });
  } catch (err) {
    console.error("Tickets GET error:", err);
    return NextResponse.json({ error: "\u062D\u062F\u062B \u062E\u0637\u0623" }, { status: 500 });
  }
}
