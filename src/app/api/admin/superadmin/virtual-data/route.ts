import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyRoleActionPassword, logAdminAction } from "@/lib/admin-auth";

async function requireOwner() {
  const session = await getSession();
  if (!session || session.role !== "superadmin" || !session.isOwner) return null;
  return session;
}

/**
 * Curated, long-lived YouTube IDs used as DEMO lecture content. They exercise
 * the real `youtube` video provider end-to-end. Replace with your own real
 * lecture videos any time — these are placeholders, not endorsed content.
 */
const DEMO_YT_IDS = [
  "WUvTyaaNkzM", // The Essence of Calculus (3Blue1Brown)
  "spUNpyF58BY", // But what is a neural network?
  "aircAruvnKk", // Neural networks intro
  "rfscVS0vtbw", // freeCodeCamp Python course
  "WPqXP_kLzpo", // Algebra basics
  "OmJ-4B-mS-Y", // Trigonometry
  "kYIS3Fz1Z9o", // Chemistry crash course
  "yQP4UJhNn0I", // Physics mechanics
];

const SUBJECTS = ["برمجه عملي", "نظري", "مشاريع"];
const STAGES = ["prep_1", "prep_2", "prep_3", "sec_1", "sec_2"];

const pick = <T,>(arr: T[], i: number) => arr[i % arr.length];
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

export async function GET() {
  const session = await requireOwner();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  try {
    const [students, teachers, courses] = await Promise.all([
      prisma.user.count({ where: { isVirtual: true, role: "student" } }),
      prisma.user.count({ where: { isVirtual: true, role: "teacher" } }),
      prisma.course.count({ where: { isVirtual: true } }),
    ]);
    return NextResponse.json({ students, teachers, courses });
  } catch {
    // Columns not migrated yet → report zeros instead of a 500.
    return NextResponse.json({ students: 0, teachers: 0, courses: 0 });
  }
}

export async function POST(req: NextRequest) {
    const __logSession = await getSession();
    if (__logSession && __logSession.role === "superadmin") {
      try {
        await logAdminAction({
          adminId: __logSession.id,
          adminName: __logSession.name,
          action: "SUPERADMIN_ACTION",
          targetType: "API_ROUTE",
          targetId: req.nextUrl ? req.nextUrl.pathname : req.url,
          targetName: req.method,
        });
      } catch (e) {}
    }

  const session = await requireOwner();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  try {
    const body = (await req.json().catch(() => ({}))) as {
      action?: "generate" | "clear";
      teachers?: number;
      students?: number;
      courses?: number;
      actionPassword?: string;
    };

    if (!verifyRoleActionPassword(session.role, body.actionPassword ?? "")) {
      return NextResponse.json({ error: "كلمة مرور المشرف غير صحيحة" }, { status: 401 });
    }

    // ── Clear all virtual data ──
    if (body.action === "clear") {
      const courses = await prisma.course.deleteMany({ where: { isVirtual: true } });
      const users = await prisma.user.deleteMany({ where: { isVirtual: true } });
      await logAdminAction({
        adminId: session.id,
        adminName: session.name,
        action: "CLEAR_VIRTUAL_DATA",
        targetType: "system",
        targetId: "virtual-data",
        targetName: "البيانات التجريبية",
        metadata: { courses: courses.count, users: users.count },
      });
      return NextResponse.json({
        success: true,
        cleared: { courses: courses.count, users: users.count },
      });
    }

    // ── Generate virtual data ──
    if (body.action !== "generate") {
      return NextResponse.json({ error: "إجراء غير صالح" }, { status: 400 });
    }

    const nTeachers = Math.min(Math.max(body.teachers ?? 3, 1), 20);
    const nStudents = Math.min(Math.max(body.students ?? 15, 1), 200);
    const nCourses = Math.min(Math.max(body.courses ?? 4, 1), 30);

    const runId = Date.now().toString(36);
    const demoHash = await bcrypt.hash(`demo-${runId}`, 10);

    // Teachers
    const teacherIds: string[] = [];
    for (let i = 0; i < nTeachers; i++) {
      const t = await prisma.user.create({
        data: {
          name: `أ. تجريبي ${i + 1}`,
          email: `demo.teacher.${runId}.${i}@demo.local`,
          password: demoHash,
          role: "teacher",
          isVirtual: true,
          isActive: true,
          profileCompleted: true,
        },
        select: { id: true },
      });
      teacherIds.push(t.id);
    }

    // Students
    for (let i = 0; i < nStudents; i++) {
      await prisma.user.create({
        data: {
          name: `طالب تجريبي ${i + 1}`,
          email: `demo.student.${runId}.${i}@demo.local`,
          password: demoHash,
          role: "student",
          isVirtual: true,
          isActive: true,
          profileCompleted: true,
          educationalStage: pick(STAGES, i),
          age: rand(12, 18),
          points: rand(0, 500),
        },
      });
    }

    // Courses with folders + YouTube videos
    let videoCount = 0;
    for (let i = 0; i < nCourses; i++) {
      const course = await prisma.course.create({
        data: {
          title: `كورس تجريبي ${i + 1} — ${pick(SUBJECTS, i)}`,
          subject: pick(SUBJECTS, i),
          educationalStage: pick(STAGES, i),
          teacherId: pick(teacherIds, i),
          description: "كورس تجريبي لأغراض العرض — يحتوي على فيديوهات يوتيوب.",
          isVirtual: true,
          maxWatchCount: 3,
          sequentialAccess: false,
        },
        select: { id: true },
      });

      const nFolders = rand(1, 2);
      for (let f = 0; f < nFolders; f++) {
        const folder = await prisma.folder.create({
          data: { name: `الوحدة ${f + 1}`, order: f, courseId: course.id },
          select: { id: true },
        });
        const nVideos = rand(2, 3);
        for (let v = 0; v < nVideos; v++) {
          await prisma.video.create({
            data: {
              title: `محاضرة ${v + 1}`,
              videoProvider: "youtube",
              providerVideoId: pick(DEMO_YT_IDS, videoCount),
              durationMinutes: rand(5, 30),
              maxWatchesPerUser: 3,
              isFree: v === 0,
              order: v,
              folderId: folder.id,
            },
          });
          videoCount++;
        }
      }
    }

    await logAdminAction({
      adminId: session.id,
      adminName: session.name,
      action: "GENERATE_VIRTUAL_DATA",
      targetType: "system",
      targetId: "virtual-data",
      targetName: "البيانات التجريبية",
      metadata: { teachers: nTeachers, students: nStudents, courses: nCourses, videos: videoCount },
    });

    return NextResponse.json({
      success: true,
      created: { teachers: nTeachers, students: nStudents, courses: nCourses, videos: videoCount },
    });
  } catch (error) {
    console.error("Virtual-data error:", error);
    const code = (error as { code?: string }).code;
    // P2021 = table missing, P2022 = column missing → schema not pushed yet.
    if (code === "P2021" || code === "P2022") {
      return NextResponse.json(
        { error: "قاعدة البيانات غير محدّثة. شغّل على الخادم: npx prisma db push" },
        { status: 503 }
      );
    }
    const detail = error instanceof Error ? error.message.slice(0, 200) : "";
    return NextResponse.json(
      { error: `تعذر تنفيذ العملية${detail ? ` — ${detail}` : ""}` },
      { status: 500 }
    );
  }
}
