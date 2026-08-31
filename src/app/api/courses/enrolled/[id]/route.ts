import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "يجب تسجيل الدخول أولاً" }, { status: 401 });
    }

    const { id: courseId } = await params;
    if (!courseId) {
      return NextResponse.json({ error: "معرّف الكورس مطلوب" }, { status: 400 });
    }

    const studentId = session.id;

    // Check if course exists
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, title: true },
    });

    if (!course) {
      return NextResponse.json({ error: "الكورس غير موجود" }, { status: 404 });
    }

    // Perform removal of enrollment and access codes in a transaction
    await prisma.$transaction(async (tx) => {
      // 1. Remove direct CourseEnrollment
      await tx.courseEnrollment.deleteMany({
        where: {
          studentId,
          courseId,
        },
      });

      // 2. Remove / unlink student from AccessCodes for this course
      await tx.accessCode.deleteMany({
        where: {
          studentId,
          courseId,
        },
      });

      // 3. Remove any folder purchases for this course
      const courseFolders = await tx.folder.findMany({
        where: { courseId },
        select: { id: true },
      });
      const folderIds = courseFolders.map((f) => f.id);
      if (folderIds.length > 0) {
        await tx.folderPurchase.deleteMany({
          where: {
            studentId,
            folderId: { in: folderIds },
          },
        });

        // 4. Remove any video purchases for this course
        const courseVideos = await tx.video.findMany({
          where: { folderId: { in: folderIds } },
          select: { id: true },
        });
        const videoIds = courseVideos.map((v) => v.id);
        if (videoIds.length > 0) {
          await tx.videoPurchase.deleteMany({
            where: {
              studentId,
              videoId: { in: videoIds },
            },
          });
        }
      }
    });

    // Log the course removal event in ActivityLog for real-time Owner monitoring
    try {
      const { logAdminAction } = await import("@/lib/admin-auth");
      await logAdminAction({
        adminId: studentId,
        adminName: session.name || "Student",
        action: "COURSE_LIBRARY_REMOVE",
        targetType: "course",
        targetId: courseId,
        targetName: course.title,
        metadata: {
          studentPhone: (session as any).phone || null,
          studentEmail: session.email || null,
          courseTitle: course.title,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (logErr) {
      console.error("Failed to log course deletion:", logErr);
    }

    return NextResponse.json({
      success: true,
      message: `تم حذف كورس "${course.title}" من مكتبتك بنجاح`,
    });
  } catch (error) {
    console.error("Error removing course from library:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء حذف الكورس من المكتبة" },
      { status: 500 }
    );
  }
}
