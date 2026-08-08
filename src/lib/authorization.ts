import { prisma } from "@/lib/prisma";
import { canBypassPayment } from "./demo";

/**
 * Checks if a student is enrolled in a course.
 * Enrolled means they have an active redeemed AccessCode bound to their studentId for the course.
 * Optional role parameter allows superadmin demo bypass evaluation on denial.
 */
export async function checkCourseEnrollment(userId: string, courseId: string, role?: string): Promise<boolean> {
  const code = await prisma.accessCode.findFirst({
    where: {
      courseId,
      studentId: userId,
      isActive: true,
      OR: [{ accessType: "TERM" }, { accessType: "COURSE" }, { accessType: null }],
    },
    select: { id: true }
  });
  if (code) return true;

  if (role) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { teacherId: true },
    });
    if (course?.teacherId && await canBypassPayment(role, course.teacherId)) {
      return true;
    }
  }

  return false;
}

/**
 * Checks if a user has access to a video/lesson.
 * - Free videos: accessible to all.
 * - Admin/Superadmin: full access.
 * - Teacher: access if they own the course.
 * - Student: access if they have course-level, folder-level, or video-level access,
 *   or plan enrollment that contains the video.
 */
export async function checkVideoAccess(userId: string, role: string, videoId: string): Promise<boolean> {
  if (role === "superadmin" || role === "admin") return true;

  const video = await prisma.video.findUnique({
    where: { id: videoId },
    include: {
      folder: {
        select: {
          id: true,
          courseId: true,
          course: { select: { teacherId: true } }
        }
      }
    }
  });

  if (!video) return false;
  if (video.isFree) return true;

  if (role === "teacher") {
    return video.folder.course.teacherId === userId;
  }

  if (role !== "student") return false;

  // 1. Check Course-level access
  const enrolled = await checkCourseEnrollment(userId, video.folder.courseId, role);
  if (enrolled) return true;

  // 2. Check Folder-level access (AccessCode or Purchase)
  const folderId = video.folderId;
  const hasFolderAccessCode = await prisma.accessCode.findFirst({
    where: {
      folderId,
      studentId: userId,
      accessType: "FOLDER",
      isActive: true,
    },
    select: { id: true }
  });
  if (hasFolderAccessCode) return true;

  const hasFolderPurchase = await prisma.folderPurchase.findUnique({
    where: { studentId_folderId: { studentId: userId, folderId } },
    select: { id: true }
  });
  if (hasFolderPurchase) return true;

  // 3. Check Video-level access (AccessCode or Purchase)
  const hasVideoAccessCode = await prisma.accessCode.findFirst({
    where: {
      videoId,
      studentId: userId,
      accessType: "VIDEO",
      isActive: true,
    },
    select: { id: true }
  });
  if (hasVideoAccessCode) return true;

  const hasVideoPurchase = await prisma.videoPurchase.findUnique({
    where: { studentId_videoId: { studentId: userId, videoId } },
    select: { id: true }
  });
  if (hasVideoPurchase) return true;

  // 4. Check Plan enrollment
  const now = new Date();
  const hasPlanEnrollment = await prisma.planEnrollment.findFirst({
    where: {
      studentId: userId,
      expiresAt: { gt: now },
      plan: {
        lessons: {
          some: {
            sources: {
              some: { videoId }
            }
          }
        }
      }
    },
    select: { id: true }
  });
  if (hasPlanEnrollment) return true;

  return false;
}

/**
 * Checks if a user has access to homework.
 * - Admin/Superadmin: full access.
 * - Teacher: access if they created the homework.
 * - Student: access if they are enrolled in the course the homework belongs to.
 */
export async function checkHomeworkAccess(userId: string, role: string, homeworkId: string): Promise<boolean> {
  if (role === "superadmin" || role === "admin") return true;

  const hw = await prisma.homework.findUnique({
    where: { id: homeworkId },
    select: {
      teacherId: true,
      courseId: true,
      videoId: true,
    }
  });

  if (!hw) return false;

  if (role === "teacher") {
    return hw.teacherId === userId;
  }

  if (role !== "student") return false;

  let courseId = hw.courseId;
  if (!courseId && hw.videoId) {
    const video = await prisma.video.findUnique({
      where: { id: hw.videoId },
      include: { folder: { select: { courseId: true } } }
    });
    if (video) {
      courseId = video.folder.courseId;
    }
  }

  if (!courseId) return false;

  return await checkCourseEnrollment(userId, courseId, role);
}
