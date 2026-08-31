import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getTeacherPercentagesFromDb, saveTeacherPercentagesToDb } from "@/lib/money-control";

/** Superadmin/Admin: Update default platform percentage or a specific teacher's percentage. */
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session || !["superadmin", "admin", "staff"].includes(session.role)) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { teacherId, percentage, defaultPercentage } = body;

    const current = await getTeacherPercentagesFromDb();

    if (defaultPercentage !== undefined) {
      const defPct = parseFloat(defaultPercentage);
      if (isNaN(defPct) || defPct < 0 || defPct > 100) {
        return NextResponse.json({ error: "النسبة الافتراضية يجب أن تكون بين 0 و 100" }, { status: 400 });
      }
      current.defaultPct = defPct;
    }

    if (teacherId && percentage !== undefined) {
      const pct = parseFloat(percentage);
      if (isNaN(pct) || pct < 0 || pct > 100) {
        return NextResponse.json({ error: "نسبة المعلم يجب أن تكون بين 0 و 100" }, { status: 400 });
      }
      current.custom[teacherId] = pct;
    }

    await saveTeacherPercentagesToDb(current);

    return NextResponse.json({
      success: true,
      defaultPercentage: current.defaultPct,
      teacherPercentages: current.custom,
    });
  } catch (error) {
    console.error("[money-control/percentages PATCH] error:", error);
    return NextResponse.json({ error: "حدث خطأ أثناء تعديل نسب الأرباح" }, { status: 500 });
  }
}
