import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { refreshLeaderboard } from "@/lib/leaderboard-refresh";

export async function POST() {
  try {
    const session = await getSession();
    if (!session || session.role !== "student") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const studentId = session.id;

    // Reset student points to 0
    await prisma.user.update({
      where: { id: studentId },
      data: {
        points: 0,
        pointsUpdatedAt: new Date(),
      },
    });

    // Refresh the leaderboard cache asynchronously so rankings recalculate
    void refreshLeaderboard(true).catch((err) => {
      console.error("Leaderboard refresh error after resetting points:", err);
    });

    return NextResponse.json({
      success: true,
      message: "تم تصفير النقاط بنجاح",
      points: 0,
    });
  } catch (error) {
    console.error("Error resetting student points:", error);
    return NextResponse.json({ error: "حدث خطأ أثناء تصفير النقاط" }, { status: 500 });
  }
}

export async function DELETE() {
  return POST();
}
