import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/admin-auth";
import {
  getActiveProviders,
  encryptSecret,
  normalizeModels,
  encryptionConfigured,
} from "@/lib/ai-provider";

async function requireSuperadmin() {
  const session = await getSession();
  if (!session || session.role !== "superadmin") return null;
  return session;
}

/** List providers — NO keys, only hasKey booleans. */
export async function GET() {
  const session = await requireSuperadmin();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  const providers = await getActiveProviders();
  return NextResponse.json({ providers, encryptionConfigured: encryptionConfigured() });
}

/** Create a provider. If apiKey is present it's encrypted; the plaintext is dropped. */
export async function POST(req: NextRequest) {
    const __logSession = await getSession();
    if (__logSession && __logSession.role === "superadmin") {
      try {
        await logAdminAction({
          adminId: __logSession.id,
          adminName: __logSession.name,
          action: "SUPERADMIN_ACTION",
          targetType: "API_ROUTE",
          targetId: req.nextUrl ? req.nextUrl.pathname : req.url,
          targetName: req.method,
        });
      } catch (e) {}
    }

  const session = await requireSuperadmin();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  try {
    const body = (await req.json().catch(() => ({}))) as {
      name?: string;
      slug?: string;
      baseUrl?: string;
      models?: unknown;
      apiKey?: string;
      isPrimary?: boolean;
      isBackup?: boolean;
      isActive?: boolean;
    };

    const name = body.name?.trim() ?? "";
    const slug = body.slug?.trim().toLowerCase().replace(/\s+/g, "-") ?? "";
    const baseUrl = body.baseUrl?.trim() ?? "";
    if (!name || !slug || !baseUrl) {
      return NextResponse.json({ error: "الاسم والمعرّف ورابط الـ API مطلوبة" }, { status: 400 });
    }
    if (body.apiKey && !encryptionConfigured()) {
      return NextResponse.json(
        { error: "لا يمكن حفظ المفتاح: لم يتم ضبط CONFIG_ENCRYPTION_KEY في الخادم" },
        { status: 400 }
      );
    }

    const exists = await prisma.aIProvider.findUnique({ where: { slug } });
    if (exists) return NextResponse.json({ error: "المعرّف مستخدم بالفعل" }, { status: 409 });

    const created = await prisma.aIProvider.create({
      data: {
        name,
        slug,
        baseUrl,
        models: normalizeModels(body.models),
        apiKeyEnc: body.apiKey ? encryptSecret(body.apiKey) : null,
        isActive: body.isActive ?? true,
        // Primary/backup flags are managed via PATCH (single-flag enforcement there).
      },
      select: { id: true, name: true },
    });

    await logAdminAction({
      adminId: session.id,
      adminName: session.name,
      action: "CREATE_AI_PROVIDER",
      targetType: "ai_provider",
      targetId: created.id,
      targetName: created.name,
    });

    return NextResponse.json({ success: true, id: created.id });
  } catch (error) {
    console.error("AI provider create error:", error);
    return NextResponse.json({ error: "تعذر إنشاء المزوّد" }, { status: 500 });
  }
}
