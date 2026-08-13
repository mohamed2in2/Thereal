import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { buildCommandCenter } from "@/services/teacher/CommandCenterService";

/**
 * GET /api/teacher/command-center
 *
 * Triage view of a teacher's own students. Every flag carries the evidence that
 * produced it and the threshold version that was in force, so a teacher can
 * always answer "why is this student on my list?".
 *
 * Authorization: a teacher may only ever see their own roster. Admins and
 * superadmins may pass ?teacherId= to inspect another teacher's view; nobody
 * else can, and a teacher's own id always wins over anything in the query
 * string so the parameter cannot be used to look sideways.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const isOperator = session.role === "admin" || session.role === "superadmin";

  let teacherId: string;
  if (session.role === "teacher") {
    // Never read teacherId from the request for a teacher — that is the IDOR.
    teacherId = session.id;
  } else if (isOperator) {
    const requested = req.nextUrl.searchParams.get("teacherId");
    if (!requested) {
      return NextResponse.json({ error: "teacherId مطلوب" }, { status: 400 });
    }
    teacherId = requested;
  } else {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  try {
    const result = await buildCommandCenter(teacherId);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[teacher/command-center] error:", error);
    return NextResponse.json({ error: "تعذر تحميل لوحة المتابعة" }, { status: 500 });
  }
}
