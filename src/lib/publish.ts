/**
 * Scheduled-unlock helpers. A video/folder with a null `publishAt` is available
 * immediately; a future `publishAt` locks it until then. A video's effective
 * unlock time is the LATER of its own and its folder's publishAt — a video can't
 * be available before the folder that contains it.
 *
 * Centralized here so every content read path + the playback gate agree.
 */

type DateInput = Date | string | null | undefined;

function ms(d: DateInput): number {
  if (!d) return 0;
  const t = new Date(d).getTime();
  return Number.isFinite(t) ? t : 0;
}

/** Effective unlock instant (ms) or null when there's no schedule. */
export function unlockTime(folderPublishAt: DateInput, videoPublishAt: DateInput): number | null {
  const max = Math.max(ms(folderPublishAt), ms(videoPublishAt));
  return max > 0 ? max : null;
}

/** Effective unlock time as ISO, or null when available now / unscheduled. */
export function unlockAtISO(folderPublishAt: DateInput, videoPublishAt: DateInput): string | null {
  const t = unlockTime(folderPublishAt, videoPublishAt);
  return t ? new Date(t).toISOString() : null;
}

/** True when the content is scheduled for a future time (not yet watchable). */
export function isScheduledLocked(
  folderPublishAt: DateInput,
  videoPublishAt: DateInput,
  now: number = Date.now()
): boolean {
  const t = unlockTime(folderPublishAt, videoPublishAt);
  return t !== null && t > now;
}

/** Parse a publishAt value from a request body into a Date | null for Prisma.
 *  Returns `undefined` when the field wasn't provided (leave unchanged). */
export function parsePublishAt(value: unknown): Date | null | undefined {
  if (value === null) return null; // explicit clear
  if (value === undefined) return undefined; // not provided
  if (typeof value !== "string" || !value.trim()) return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}
