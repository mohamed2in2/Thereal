import { prisma } from "./prisma";
import { acquireAdvisoryLock } from "./distributed-lock";
import { withDbRetry } from "./db-retry";

// 1. Normalization helpers
export function normalizeTitle(title: string): string {
  let s = title.trim();
  // Strip Arabic diacritics (tashkeel)
  s = s.replace(/[\u0617-\u061A\u064B-\u0652]/g, "");
  // Convert Arabic-Indic digits to ASCII (٠١٢٣٤٥٦٧٨٩ -> 0123456789)
  s = s.replace(/[٠-٩]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0x0660 + 48));
  
  // Replace common Arabic ordinals with digits
  const ordinals: Record<string, string> = {
    "الاول": "1", "الأول": "1", "الاولى": "1", "الأولى": "1",
    "الثاني": "2", "الثانيه": "2", "الثانية": "2",
    "الثالث": "3", "الثالثه": "3", "الثالثة": "3",
    "الرابع": "4", "الرابعه": "4", "الرابعة": "4",
    "الخامس": "5", "الخامسه": "5", "الخامسة": "5",
    "السادس": "6", "السادسه": "6", "السادسة": "6",
    "السابع": "7", "السابعه": "7", "السابعة": "7",
    "الثامن": "8", "الثامنه": "8", "الثامنة": "8",
    "التاسع": "9", "التاسعه": "9", "التاسعة": "9",
    "العاشر": "10", "العاشره": "10", "العاشرة": "10",
  };
  
  for (const [word, digit] of Object.entries(ordinals)) {
    const regex = new RegExp(`\\b${word}\\b`, 'g');
    s = s.replace(regex, digit);
  }
  
  return s;
}

export function extractNumber(title: string): number | null {
  const normalized = normalizeTitle(title);
  const match = normalized.match(/\d+/);
  if (match) return parseInt(match[0], 10);
  return null;
}

/**
 * Triggered when a video is created, edited, or deleted.
 * Finds all plans linked to this video's course and re-syncs them.
 */
export async function triggerPlanSyncForCourse(courseId: string) {
  const links = await prisma.planCourseLink.findMany({
    where: { courseId },
    select: { planId: true },
  });

  // Sync each plan sequentially to avoid massive concurrent load
  for (const link of links) {
    await syncCourseToPlan(link.planId, courseId).catch(err => {
      console.error(`Failed to sync course ${courseId} to plan ${link.planId}`, err);
    });
  }
}

/**
 * The core auto-matching engine.
 * Serialized per plan using advisory locks.
 */
export async function syncCourseToPlan(planId: string, courseId: string) {
  return withDbRetry(async () => {
    return prisma.$transaction(async (tx: any) => {
      // 1. Acquire distributed lock to prevent concurrent sync races for this plan
      await acquireAdvisoryLock(`plan-sync-${planId}`, tx);

      const plan = await tx.plan.findUnique({
        where: { id: planId },
        include: { lessons: { orderBy: { order: "asc" } } },
      });
      if (!plan || plan.lessons.length === 0) return;

      const link = await tx.planCourseLink.findFirst({
        where: { planId, courseId },
      });
      if (!link) return;

      const course = await tx.course.findUnique({
        where: { id: courseId },
        include: {
          folders: {
            where: link.folderId ? { id: link.folderId } : undefined,
            orderBy: { order: "asc" },
            include: {
              videos: { orderBy: { order: "asc" } }
            }
          }
        }
      });
      if (!course) return;

      // Collect all videos in order
      const allVideos: { videoId: string; folderId: string; videoTitle: string; teacherId: string; monthIndex: number | null; lessonIndexInMonth: number | null }[] = [];
      
      for (const folder of course.folders) {
        // Auto-extract month index if not manual
        let mIndex = folder.monthIndex;
        if (!folder.monthIndexIsManual) {
          const parsed = extractNumber(folder.name);
          if (parsed !== null) mIndex = parsed;
        }

        for (const video of folder.videos) {
          // Auto-extract lesson index if not manual
          let lIndex = video.lessonIndexInMonth;
          if (!video.lessonIndexIsManual) {
            const parsed = extractNumber(video.title);
            if (parsed !== null) lIndex = parsed;
          }

          allVideos.push({
            videoId: video.id,
            folderId: folder.id,
            videoTitle: video.title,
            teacherId: course.teacherId,
            monthIndex: mIndex,
            lessonIndexInMonth: lIndex
          });
        }
      }

      // Filter to videos matching the plan's month index
      const monthVideos = allVideos.filter(v => v.monthIndex === null || v.monthIndex === plan.monthIndex);

      // Sort by auto-extracted lesson index, fallback to natural order
      monthVideos.sort((a, b) => {
        if (a.lessonIndexInMonth !== null && b.lessonIndexInMonth !== null) {
          if (a.lessonIndexInMonth !== b.lessonIndexInMonth) return a.lessonIndexInMonth - b.lessonIndexInMonth;
        }
        return 0; // maintain natural order if indices missing/equal
      });

      // Apply slicing if specified in the link
      let slicedVideos = monthVideos;
      if (link.startIndex !== null || link.endIndex !== null) {
        const start = link.startIndex ?? 0;
        const end = link.endIndex !== null ? link.endIndex : slicedVideos.length - 1;
        slicedVideos = slicedVideos.slice(start, end + 1);
      }

      // Map to available lessons
      const lessonsToUpdate = Math.min(slicedVideos.length, plan.lessons.length);
      
      for (let i = 0; i < slicedVideos.length; i++) {
        const video = slicedVideos[i];
        
        if (i < plan.lessons.length) {
          const targetLesson = plan.lessons[i];
          
          // Check if this video is already a source
          const existingSource = await tx.planLessonSource.findFirst({
            where: { planLessonId: targetLesson.id, videoId: video.videoId }
          });

          if (!existingSource) {
            await tx.planLessonSource.create({
              data: {
                planLessonId: targetLesson.id,
                videoId: video.videoId,
                teacherId: video.teacherId,
                isDefault: false, // Let admin choose the default
                isManual: false
              }
            });
          }
          
          // Optionally resolve unmatched content if it existed
          await tx.unmatchedPlanContent.updateMany({
            where: { videoId: video.videoId, resolvedAt: null },
            data: { resolvedAt: new Date() }
          });
          
        } else {
          // Unmatched (plan doesn't have enough lessons)
          const existingUnmatched = await tx.unmatchedPlanContent.findFirst({
            where: { videoId: video.videoId, courseId, resolvedAt: null }
          });
          if (!existingUnmatched) {
            await tx.unmatchedPlanContent.create({
              data: {
                teacherId: video.teacherId,
                videoId: video.videoId,
                courseId,
                title: video.videoTitle,
                reason: "لا يوجد عدد كافي من الدروس في الخطة لاستيعاب هذا الفيديو"
              }
            });
          }
        }
      }
    });
  });
}
