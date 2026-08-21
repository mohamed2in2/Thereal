import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  testVdoCipherApiKey,
  decryptVdoCipherSecret,
} from "@/lib/vdocipher-accounts";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "superadmin" && session.role !== "admin")) {
      return NextResponse.json({ error: "غير مصرح لك بالوصول" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      apiKey?: string;
      accountId?: string;
    };

    let keyToTest = (body.apiKey || "").trim();

    if (!keyToTest && body.accountId) {
      const account = await prisma.vdoCipherAccount.findUnique({
        where: { id: body.accountId },
      });
      if (account) {
        keyToTest = decryptVdoCipherSecret(account.apiKeyEnc);
      }
    }

    if (!keyToTest) {
      return NextResponse.json({ error: "مفتاح API Secret مطلوب للفحص" }, { status: 400 });
    }

    const result = await testVdoCipherApiKey(keyToTest);

    return NextResponse.json({
      success: result.ok,
      ok: result.ok,
      totalVideos: result.totalVideos,
      error: result.error,
      message: result.ok
        ? `الاتصال بـ VdoCipher ناجح ومفتاح الـ API صالح! (إجمالي الفيديوهات: ${result.totalVideos})`
        : result.error || "فشل الاتصال بـ VdoCipher",
    });
  } catch (error: any) {
    console.error("[Superadmin Test VdoCipher Connection] Error:", error);
    return NextResponse.json(
      { error: error.message || "حدث خطأ أثناء فحص الاتصال" },
      { status: 500 }
    );
  }
}
