import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveThresholds, publishThresholds } from "@/services/teacher/CommandCenterService";

/** GET — the active thresholds plus the full version history. */
export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "superadmin") {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const [active, history] = await Promise.all([
    getActiveThresholds(),
    prisma.teacherAlertThresholds.findMany({
      orderBy: { version: "desc" },
      take: 50,
      select: {
        version: true,
        isActive: true,
        behindPacePercent: true,
        behindPeerPercent: true,
        decliningDropPoints: true,
        decliningWindow: true,
        inactiveDays: true,
        strugglingWrongPercent: true,
        strugglingMinAttempts: true,
        note: true,
        createdAt: true,
      },
    }),
  ]);

  return NextResponse.json({ active, history });
}

/**
 * POST — publish a new version.
 *
 * Thresholds are append-only: this never edits an existing row, so a count a
 * teacher acted on can still be explained by the rules that were live then.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "superadmin") {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));

  // Bounds keep a typo from silently disabling a signal (e.g. 0% pace would
  // flag nobody; 100 days inactive would flag nobody either).
  const NUMERIC_BOUNDS: Record<string, [number, number]> = {
    behindPacePercent: [1, 100],
    behindPeerPercent: [1, 100],
    decliningDropPoints: [1, 100],
    decliningWindow: [2, 20],
    inactiveDays: [1, 90],
    strugglingWrongPercent: [1, 100],
    strugglingMinAttempts: [1, 100],
  };

  const next: Record<string, number> = {};
  for (const [key, [min, max]] of Object.entries(NUMERIC_BOUNDS)) {
    const raw = body[key];
    if (raw === undefined || raw === null) continue;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < min || value > max) {
      return NextResponse.json(
        { error: `${key} يجب أن يكون رقماً بين ${min} و ${max}` },
        { status: 400 }
      );
    }
    next[key] = value;
  }

  if (Object.keys(next).length === 0) {
    return NextResponse.json({ error: "لم يتم تغيير أي قيمة" }, { status: 400 });
  }

  try {
    const published = await publishThresholds(
      next,
      session.id,
      typeof body.note === "string" ? body.note.slice(0, 500) : undefined
    );
    return NextResponse.json({ success: true, active: published });
  } catch (error) {
    console.error("[alert-thresholds] publish failed:", error);
    return NextResponse.json({ error: "تعذر حفظ الإعدادات" }, { status: 500 });
  }
}
