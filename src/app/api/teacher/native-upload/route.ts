import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { initAlaslyUpload, completeAlaslyUpload } from "@/lib/alasly";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "teacher" && session.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const body = await req.json();
    const action = body.action || "init";

    if (action === "init") {
      const filename = body.filename || "video.mp4";
      const contentType = body.contentType || "video/mp4";
      const size = Number(body.size) || 0;

      const result = await initAlaslyUpload(filename, contentType, size);
      return NextResponse.json({ success: true, ...result });
    }

    if (action === "complete") {
      const assetId = body.assetId || body.asset_id;
      if (!assetId) {
        return NextResponse.json({ error: "assetId مطلوب لإتمام الرفع" }, { status: 400 });
      }

      const result = await completeAlaslyUpload(assetId);
      return NextResponse.json({ success: true, ...result });
    }

    return NextResponse.json({ error: "إجراء غير معروف" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "فشل الاتصال بخدمة Native Video" }, { status: 500 });
  }
}
