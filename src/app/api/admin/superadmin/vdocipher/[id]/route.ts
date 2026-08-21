import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  encryptVdoCipherSecret,
  BYTES_PER_GB,
  getAccountWithComputedStats,
} from "@/lib/vdocipher-accounts";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "superadmin" && session.role !== "admin")) {
      return NextResponse.json({ error: "غير مصرح لك بالوصول" }, { status: 403 });
    }

    const { id } = await params;
    const account = await prisma.vdoCipherAccount.findUnique({
      where: { id },
      include: {
        _count: { select: { videoAssets: true } },
        videoAssets: {
          include: { video: { select: { id: true, title: true, durationMinutes: true } } },
          take: 20,
        },
      },
    });

    if (!account) {
      return NextResponse.json({ error: "الحساب غير موجود" }, { status: 404 });
    }

    const publicAccount = await getAccountWithComputedStats(account);

    return NextResponse.json({
      success: true,
      account: {
        ...publicAccount,
        recentVideos: account.videoAssets.map((va) => ({
          assetId: va.id,
          vdoCipherVideoId: va.vdoCipherVideoId,
          status: va.status,
          video: va.video,
          createdAt: va.createdAt,
        })),
      },
    });
  } catch (error: any) {
    console.error("[Superadmin Get VdoCipher Account] Error:", error);
    return NextResponse.json(
      { error: error.message || "تعذر جلب بيانات الحساب" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "superadmin") {
      return NextResponse.json({ error: "غير مصرح لك بالوصول (المشرف العام فقط)" }, { status: 403 });
    }

    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as {
      name?: string;
      apiKey?: string;
      playerId?: string | null;
      bandwidthLimitGb?: number;
      bandwidthUsedGb?: number;
      expiresAt?: string;
      extendDays?: number;
      isActive?: boolean;
      notes?: string;
    };

    const existing = await prisma.vdoCipherAccount.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "الحساب غير موجود" }, { status: 404 });
    }

    const updateData: any = {};

    if (body.name && typeof body.name === "string") {
      updateData.name = body.name.trim();
    }

    if (body.apiKey && typeof body.apiKey === "string" && body.apiKey.trim()) {
      updateData.apiKeyEnc = encryptVdoCipherSecret(body.apiKey.trim());
    }

    if (body.playerId !== undefined) {
      updateData.playerId = body.playerId ? body.playerId.trim() : null;
    }

    if (typeof body.bandwidthLimitGb === "number" && body.bandwidthLimitGb > 0) {
      updateData.bandwidthLimitBytes = BigInt(Math.round(body.bandwidthLimitGb * BYTES_PER_GB));
    }

    if (typeof body.bandwidthUsedGb === "number" && body.bandwidthUsedGb >= 0) {
      updateData.bandwidthUsedBytes = BigInt(Math.round(body.bandwidthUsedGb * BYTES_PER_GB));
    }

    if (typeof body.extendDays === "number" && body.extendDays > 0) {
      const currentExpiry = new Date(existing.expiresAt);
      const base = currentExpiry > new Date() ? currentExpiry : new Date();
      updateData.expiresAt = new Date(base.getTime() + body.extendDays * 24 * 60 * 60 * 1000);
    } else if (body.expiresAt) {
      updateData.expiresAt = new Date(body.expiresAt);
    }

    if (typeof body.isActive === "boolean") {
      updateData.isActive = body.isActive;
    }

    if (body.notes !== undefined) {
      updateData.notes = body.notes ? body.notes.trim() : null;
    }

    const updated = await prisma.vdoCipherAccount.update({
      where: { id },
      data: updateData,
    });

    const publicAccount = await getAccountWithComputedStats(updated);

    return NextResponse.json({
      success: true,
      account: publicAccount,
      message: "تم تحديث بيانات حساب VdoCipher بنجاح",
    });
  } catch (error: any) {
    console.error("[Superadmin Update VdoCipher Account] Error:", error);
    return NextResponse.json(
      { error: error.message || "تعذر تحديث الحساب" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "superadmin") {
      return NextResponse.json({ error: "غير مصرح لك بالوصول (المشرف العام فقط)" }, { status: 403 });
    }

    const { id } = await params;
    const existing = await prisma.vdoCipherAccount.findUnique({
      where: { id },
      include: { _count: { select: { videoAssets: true } } },
    });

    if (!existing) {
      return NextResponse.json({ error: "الحساب غير موجود" }, { status: 404 });
    }

    // Delete account and cascade
    await prisma.vdoCipherAccount.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: `تم حذف الحساب (${existing.name}) بنجاح`,
    });
  } catch (error: any) {
    console.error("[Superadmin Delete VdoCipher Account] Error:", error);
    return NextResponse.json(
      { error: error.message || "تعذر حذف الحساب" },
      { status: 500 }
    );
  }
}
