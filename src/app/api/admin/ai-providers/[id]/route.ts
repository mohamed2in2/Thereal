import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/admin-auth";
import { encryptSecret, normalizeModels, encryptionConfigured } from "@/lib/ai-provider";

async function requireSuperadmin() {
  const session = await getSession();
  if (!session || session.role !== "superadmin") return null;
  return session;
}

/** Update a provider. A present apiKey is encrypted and overwrites the old one. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as {
      name?: string;
      baseUrl?: string;
      models?: unknown;
      apiKey?: string;
      isPrimary?: boolean;
      isBackup?: boolean;
      isActive?: boolean;
    };

    const existing = await prisma.aIProvider.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "المزوّد غير موجود" }, { status: 404 });

    const data: Record<string, unknown> = {};
    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
    if (typeof body.baseUrl === "string" && body.baseUrl.trim()) data.baseUrl = body.baseUrl.trim();
    if (body.models !== undefined) data.models = normalizeModels(body.models);
    if (typeof body.isActive === "boolean") data.isActive = body.isActive;

    // Key rotation — encrypt and overwrite; plaintext is never stored or returned.
    if (typeof body.apiKey === "string" && body.apiKey) {
      if (!encryptionConfigured()) {
        return NextResponse.json(
          { error: "لا يمكن حفظ المفتاح: لم يتم ضبط CONFIG_ENCRYPTION_KEY في الخادم" },
          { status: 400 }
        );
      }
      data.apiKeyEnc = encryptSecret(body.apiKey);
    }

    // Single primary / single backup, and a provider can't be both at once.
    if (body.isPrimary === true) {
      await prisma.aIProvider.updateMany({ where: { isPrimary: true }, data: { isPrimary: false } });
      data.isPrimary = true;
      data.isBackup = false; // primary can't also be the backup
    } else if (body.isPrimary === false) {
      data.isPrimary = false;
    }
    if (body.isBackup === true) {
      await prisma.aIProvider.updateMany({ where: { isBackup: true }, data: { isBackup: false } });
      data.isBackup = true;
      data.isPrimary = false; // backup can't also be the primary
    } else if (body.isBackup === false) {
      data.isBackup = false;
    }

    await prisma.aIProvider.update({ where: { id }, data });

    await logAdminAction({
      adminId: session.id,
      adminName: session.name,
      action: "EDIT_AI_PROVIDER",
      targetType: "ai_provider",
      targetId: id,
      targetName: existing.name,
      metadata: { keyRotated: !!body.apiKey },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("AI provider PATCH error:", error);
    return NextResponse.json({ error: "تعذر تعديل المزوّد" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSuperadmin();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  try {
    const { id } = await params;
    const existing = await prisma.aIProvider.findUnique({ where: { id }, select: { name: true } });
    if (!existing) return NextResponse.json({ error: "المزوّد غير موجود" }, { status: 404 });

    await prisma.aIProvider.delete({ where: { id } });

    await logAdminAction({
      adminId: session.id,
      adminName: session.name,
      action: "DELETE_AI_PROVIDER",
      targetType: "ai_provider",
      targetId: id,
      targetName: existing.name,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("AI provider DELETE error:", error);
    return NextResponse.json({ error: "تعذر حذف المزوّد" }, { status: 500 });
  }
}
