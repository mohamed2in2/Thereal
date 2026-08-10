import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { logAdminAction } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import {
  getLeaderboardPrizes,
  saveLeaderboardPrizes,
  refreshLeaderboard,
  DEFAULT_LEADERBOARD_PRIZES,
  type LeaderboardPrize,
} from "@/lib/leaderboard-refresh";

/**
 * GET — Get leaderboard prizes configuration & cache status
 */
export async function GET() {
  const session = await getSession();
  if (!session || (session.role !== "superadmin" && session.role !== "admin")) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const prizes = await getLeaderboardPrizes();

  const mainCache = await prisma.leaderboardCache.findUnique({
    where: { key: "leaderboard_data" },
  });

  const prizesCache = await prisma.leaderboardCache.findUnique({
    where: { key: "leaderboard_prizes" },
  });

  let parsedCache: any = null;
  if (mainCache?.data) {
    try {
      parsedCache = JSON.parse(mainCache.data);
    } catch {}
  }

  return NextResponse.json({
    prizes,
    defaults: DEFAULT_LEADERBOARD_PRIZES,
    lastCalculatedAt: mainCache?.updatedAt ?? null,
    prizesUpdatedAt: prizesCache?.updatedAt ?? null,
    studentCount: Object.keys(parsedCache?.userRanks || {}).length,
    topStudentsCount: parsedCache?.topStudents?.admin?.length || 0,
  });
}

/**
 * POST — Update leaderboard prizes or force refresh rankings
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "superadmin") {
    return NextResponse.json({ error: "غير مصرح للمشرف العام فقط" }, { status: 403 });
  }

  try {
    const body = await req.json() as {
      action?: "save_prizes" | "force_recalculate" | "reset_defaults";
      prizes?: LeaderboardPrize[];
    };

    if (body.action === "force_recalculate") {
      console.log(`[Superadmin ${session.name}] Forced 24H leaderboard recalculation...`);
      await refreshLeaderboard(true);

      await logAdminAction({
        adminId: session.id,
        adminName: session.name,
        action: "SUPERADMIN_ACTION",
        targetType: "LEADERBOARD",
        targetId: "leaderboard_cache",
        targetName: "Force Recalculate 24H Leaderboard",
      });

      return NextResponse.json({
        success: true,
        message: "تمت إعادة احتساب وتحديث لوحة الشرف وجميع المراكز والجوائز فوراً بنجاح ✅",
      });
    }

    if (body.action === "reset_defaults") {
      await saveLeaderboardPrizes(DEFAULT_LEADERBOARD_PRIZES);

      await logAdminAction({
        adminId: session.id,
        adminName: session.name,
        action: "SUPERADMIN_ACTION",
        targetType: "LEADERBOARD",
        targetId: "leaderboard_prizes",
        targetName: "Reset Prizes to Defaults",
      });

      return NextResponse.json({
        success: true,
        prizes: DEFAULT_LEADERBOARD_PRIZES,
        message: "تمت استعادة الجوائز الافتراضية بنجاح ✅",
      });
    }

    // Save custom prizes (ensure array of 10 items)
    if (Array.isArray(body.prizes) && body.prizes.length > 0) {
      // Validate and sanitize 10 prizes
      const sanitized: LeaderboardPrize[] = body.prizes.map((p, idx) => ({
        rank: p.rank || idx + 1,
        rankLabel: p.rankLabel || `المركز ${idx + 1}`,
        title: p.title?.trim() || `المركز ${idx + 1}`,
        prize: p.prize?.trim() || "جائزة تفوق",
        icon: p.icon || (idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : "🎁"),
        highlight: typeof p.highlight === "boolean" ? p.highlight : idx < 3,
      }));

      await saveLeaderboardPrizes(sanitized);

      await logAdminAction({
        adminId: session.id,
        adminName: session.name,
        action: "SUPERADMIN_ACTION",
        targetType: "LEADERBOARD",
        targetId: "leaderboard_prizes",
        targetName: "Update Leaderboard 10 Prizes",
      });

      return NextResponse.json({
        success: true,
        prizes: sanitized,
        message: "تم حفظ جوائز المراكز العشرة بنجاح وتحديث الكاش فوراً ✅",
      });
    }

    return NextResponse.json({ error: "بيانات الجوائز غير صالحة" }, { status: 400 });
  } catch (err: any) {
    console.error("Failed to update leaderboard prizes:", err);
    return NextResponse.json({ error: err.message || "فشل تحديث الجوائز" }, { status: 500 });
  }
}
