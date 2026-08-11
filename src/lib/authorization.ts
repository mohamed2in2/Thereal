import { prisma } from "@/lib/prisma";
import { canBypassPayment } from "./demo";

/**
 * Checks if a student is enrolled in a course.
 * Enrolled means they have an active redeemed AccessCode bound to their studentId for the course.
 * Optional role parameter allows superadmin demo bypass evaluation on denial.
 */
export async function checkCourseEnrollment(userId: string, courseId: string, role?: string): Promise<boolean> {
  const directEnrollment = await prisma.courseEnrollment.findUnique({
    where: { studentId_courseId: { studentId: userId, courseId } },
    select: { id: true },
  });
  if (directEnrollment) return true;

  const code = await prisma.accessCode.findFirst({
    where: {
      courseId,
      studentId: userId,
      isActive: true,
      OR: [{ accessType: "TERM" }, { accessType: "COURSE" }, { folderId: null, videoId: null }],
    },
    select: { id: true }
  });
  if (code) return true;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { accountMode: true, testerCapabilities: true },
  });
  if (user && user.accountMode === "TESTER") {
    return true;
  }

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
 * - Student: access if they are subscribed to teacher, enrolled in course, purchased folder/video, or if content is free.
 */
export async function checkHomeworkAccess(userId: string, role: string, homeworkId: string): Promise<boolean> {
  if (role === "superadmin" || role === "admin") return true;

  const hw = await prisma.homework.findUnique({
    where: { id: homeworkId },
    select: {
      teacherId: true,
      courseId: true,
      folderId: true,
      videoId: true,
    }
  });

  if (!hw) return false;

  if (role === "teacher") {
    return hw.teacherId === userId;
  }

  if (role !== "student") return false;

  // 1. Teacher subscription access
  const now = new Date();
  const activeSub = await prisma.teacherSubscription.findFirst({
    where: {
      studentId: userId,
      teacherId: hw.teacherId,
      status: "active",
      expiresAt: { gt: now },
    },
    select: { id: true },
  });
  if (activeSub) return true;

  // 2. Demo bypass check
  if (await canBypassPayment(role, hw.teacherId)) return true;

  // 3. Resolve courseId / folderId
  let courseId = hw.courseId;
  let folderId = hw.folderId;

  if (hw.videoId) {
    const video = await prisma.video.findUnique({
      where: { id: hw.videoId },
      include: { folder: { select: { id: true, courseId: true } } }
    });
    if (video) {
      if (!folderId) folderId = video.folder.id;
      if (!courseId) courseId = video.folder.courseId;
      // Check video access directly
      const hasVideoAccess = await checkVideoAccess(userId, role, hw.videoId);
      if (hasVideoAccess) return true;
    }
  }

  if (folderId && !courseId) {
    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
      select: { courseId: true },
    });
    if (folder) courseId = folder.courseId;
  }

  // 4. Folder-level purchase or access code
  if (folderId) {
    const hasFolderCode = await prisma.accessCode.findFirst({
      where: { folderId, studentId: userId, accessType: "FOLDER", isActive: true },
      select: { id: true },
    });
    if (hasFolderCode) return true;

    const hasFolderPurchase = await prisma.folderPurchase.findUnique({
      where: { studentId_folderId: { studentId: userId, folderId } },
      select: { id: true },
    });
    if (hasFolderPurchase) return true;
  }

  // 5. Course enrollment & free course check
  if (courseId) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { isPaid: true, price: true },
    });
    if (course && (!course.isPaid || course.price === 0)) return true;

    const isEnrolled = await checkCourseEnrollment(userId, courseId, role);
    if (isEnrolled) return true;
  }

  // If homework is teacher-level with no course/folder restriction
  if (!courseId && !folderId && !hw.videoId) {
    // Accessible if student is enrolled in any active course of the teacher
    const anyCourseCode = await prisma.accessCode.findFirst({
      where: {
        studentId: userId,
        isActive: true,
        course: { teacherId: hw.teacherId },
      },
      select: { id: true },
    });
    if (anyCourseCode) return true;
  }

  return false;
}
