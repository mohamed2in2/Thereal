/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getConfigNumberClamped } from "@/lib/config";
import { canBypassPayment } from "@/lib/demo";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const { id } = await params;
    const role = session.role;
    let isTeacherPreview = false;

    if (role === "teacher") {
      const ownsCourse = await prisma.course.count({
        where: { id, teacherId: session.id },
      });
      if (!ownsCourse) {
        const hasAccess = await prisma.accessCode.findFirst({
          where: { courseId: id, studentId: session.id },
        });
        const courseRow = await prisma.course.findUnique({
          where: { id },
          select: { isPaid: true, price: true },
        });
        const isFree = !courseRow?.isPaid || (courseRow?.price ?? 0) === 0;

        if (!hasAccess && !isFree) {
          return NextResponse.json(
            {
              error: "أنت مُعلّم — يمكنك معاينة كورساتك الخاصة أو الكورسات المسجل بها فقط.",
              code: "TEACHER_NOT_ALLOWED",
            },
            { status: 403 }
          );
        }
      }
      isTeacherPreview = true;
    }
    if (role === "staff") {
      return NextResponse.json(
        { error: "هذه الصفحة مخصّصة للطلاب فقط.", code: "STAFF_NOT_ALLOWED" },
        { status: 403 }
      );
    }
    let hasPlanAccess = false;
    let allowedVideoIds: string[] = [];

    if (role === "student") {
      const access = await prisma.accessCode.findFirst({
        where: { courseId: id, studentId: session.id },
      });
      if (!access) {
        const enrolledPlans = await prisma.planEnrollment.findMany({
          where: {
            studentId: session.id,
            expiresAt: { gt: new Date() },
          },
          include: {
            plan: {
              include: {
                lessons: {
                  include: {
                    sources: {
                      include: {
                        video: true
                      }
                    }
                  }
                }
              }
            }
          }
        });

        const videoIds: string[] = [];
        for (const enroll of enrolledPlans) {
          for (const lesson of enroll.plan.lessons) {
            for (const src of lesson.sources) {
              if (src.videoId) {
                videoIds.push(src.videoId);
              }
            }
          }
        }

        if (videoIds.length > 0) {
          const matchingVideosCount = await prisma.video.count({
            where: {
              id: { in: videoIds },
              folder: { courseId: id }
            }
          });
          if (matchingVideosCount > 0) {
            hasPlanAccess = true;
            allowedVideoIds = videoIds;
          }
        }

        if (!hasPlanAccess) {
          const targetCourseRow = await prisma.course.findUnique({
            where: { id },
            select: { teacherId: true },
          });
          const canBypass = await canBypassPayment(role, targetCourseRow?.teacherId);
          if (!canBypass) {
            return NextResponse.json(
              { error: "لا يوجد صلاحية للوصول. فعّل كود الكورس أو تواصل مع المعلم.", code: "NOT_ENROLLED" },
              { status: 403 }
            );
          }
        }
      }
    }

    const course = await prisma.course.findFirst({
      where: {
        id,
        teacher: role === "superadmin" ? { isDeleted: false } : { isDeleted: false, isDemo: false },
      },
      include: {
        teacher: { select: { id: true, name: true } },
        folders: {
          orderBy: { order: "asc" },
          include: {
            videos: {
              orderBy: { order: "asc" },
              include: {
                progress: {
                  where: { studentId: session.id },
                  select: { watched: true, watchedAt: true, lastPositionSeconds: true },
                },
                watchSessions: {
                  where: { studentId: session.id, usedWatchSlot: true },
                  select: { id: true },
                },
              },
            },
            materials: { orderBy: { order: "asc" } },
            quizzes: {
              select: ({
                id: true,
                title: true,
                timeLimitMinutes: true,
                questions: { orderBy: { order: "asc" } },
              } as any),
            },
          },
        },
      },
    });

    if (!course) return NextResponse.json({ error: "الكورس غير موجود" }, { status: 404 });

    const foldersToMap = (role === "student" && hasPlanAccess)
      ? course.folders
          .map((folder) => {
            const videos = folder.videos.filter((v) => allowedVideoIds.includes(v.id));
            if (videos.length === 0) return null;
            return {
              ...folder,
              videos,
            };
          })
          .filter(Boolean) as any[]
      : course.folders;

    const safeCourse = {
      ...course,
      homeworkUrl: course.homeworkUrl,
      maxWatchCount: course.maxWatchCount,
      folders: (foldersToMap as any[]).map((folder: any) => ({
        ...folder,
        videos: (folder.videos || []).map((video: any) => ({
          ...video,
          vdoCipherId: undefined,
          providerVideoId: undefined,
          usedWatches: video.watchSessions?.length || 0,
          watchSessions: undefined,
        })),
        quizzes: (folder.quizzes || []).map((quiz: any) => {
          const q = quiz as unknown as {
            id: string;
            title: string;
            timeLimitMinutes: number;
            questions?: Array<{ correctAnswer?: string; [key: string]: unknown }>;
          };
          return {
            id: q.id,
            title: q.title,
            timeLimitMinutes: q.timeLimitMinutes,
            questions: (q.questions ?? []).map((question) => ({ ...question, correctAnswer: undefined })),
          };
        }),
      })),
    };

    // Mark-complete gate (% watched) is superadmin-configurable (was 80).
    const markCompleteThreshold = await getConfigNumberClamped("mark_complete_threshold", 1, 100);
    return NextResponse.json({ course: safeCourse, markCompleteThreshold, isTeacherPreview });
  } catch (error) {
    console.error("[courses/[id]] error:", error);
    return NextResponse.json({ error: "حدث خطأ داخلي" }, { status: 500 });
  }
}
