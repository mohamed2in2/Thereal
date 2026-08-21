/**
 * Per-student watch allowance for a video.
 *
 * The base limit lives on Video.maxWatchesPerUser and applies to everyone.
 * A teacher can grant extra views to one student by approving a
 * VideoViewRequest; those grants accumulate here rather than by editing
 * maxWatchesPerUser, which would widen the limit for every student at once.
 */

import { Prisma } from "@/generated/prisma";

/** Satisfied by both the Prisma client and a transaction client. */
type ViewRequestReader = Pick<Prisma.TransactionClient, "videoViewRequest">;

export async function getGrantedViews(
  client: ViewRequestReader,
  studentId: string,
  videoId: string
): Promise<number> {
  const granted = await client.videoViewRequest.aggregate({
    where: { studentId, videoId, status: "approved" },
    _sum: { grantedViews: true },
  });
  // Negative grants would silently shrink a student's paid allowance, so the
  // floor is 0 even if a bad row somehow gets written.
  return Math.max(0, granted._sum.grantedViews ?? 0);
}

export async function getWatchAllowance(
  client: ViewRequestReader,
  studentId: string,
  videoId: string,
  baseLimit: number
): Promise<number> {
  const base = Number.isFinite(baseLimit) && baseLimit > 0 ? baseLimit : 0;
  return base + (await getGrantedViews(client, studentId, videoId));
}
