import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getAllAccountsWithStats,
  encryptVdoCipherSecret,
  BYTES_PER_GB,
  DEFAULT_BANDWIDTH_LIMIT_BYTES,
  DEFAULT_VALIDITY_DAYS,
  getAccountWithComputedStats,
} from "@/lib/vdocipher-accounts";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "superadmin" && session.role !== "admin")) {
      return NextResponse.json({ error: "غير مصرح لك بالوصول" }, { status: 403 });
    }

    const accounts = await getAllAccountsWithStats();

    const totalBandwidthLimitGb = Number(
      accounts.reduce((sum, a) => sum + a.bandwidthLimitGb, 0).toFixed(2)
    );
    const totalBandwidthUsedGb = Number(
      accounts.reduce((sum, a) => sum + a.bandwidthUsedGb, 0).toFixed(2)
    );
    const totalSafeRemainingGb = Number(
      accounts.reduce((sum, a) => sum + a.bandwidthSafeRemainingGb, 0).toFixed(2)
    );
    const totalActiveViewers = accounts.reduce((sum, a) => sum + a.activeViewersCount, 0);

    return NextResponse.json({
      success: true,
      accounts,
      kpis: {
        totalAccounts: accounts.length,
        activeAccounts: accounts.filter((a) => a.isActive && !a.isExpired).length,
        expiredAccounts: accounts.filter((a) => a.isExpired).length,
        totalBandwidthLimitGb,
        totalBandwidthUsedGb,
        totalSafeRemainingGb,
        totalActiveViewers,
      },
    });
  } catch (error: any) {
    console.error("[Superadmin VdoCipher Accounts API] Error:", error);
    return NextResponse.json(
      { error: error.message || "تعذر جلب حسابات VdoCipher" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "superadmin") {
      return NextResponse.json({ error: "غير مصرح لك بالوصول (المشرف العام فقط)" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      name?: string;
      apiKey?: string;
      playerId?: string | null;
      bandwidthLimitGb?: number;
      validityDays?: number;
      notes?: string;
    };

    const name = (body.name || "").trim();
    const apiKey = (body.apiKey || "").trim();

    if (!name) {
      return NextResponse.json({ error: "اسم الحساب أو معرفه مطلوب (مثال: الحساب 01)" }, { status: 400 });
    }

    if (!apiKey) {
      return NextResponse.json({ error: "مفتاح API Secret الخاص بـ VdoCipher مطلوب" }, { status: 400 });
    }

    // Encrypt the API key with AES-256-GCM
    const apiKeyEnc = encryptVdoCipherSecret(apiKey);

    const limitGb =
      typeof body.bandwidthLimitGb === "number" && body.bandwidthLimitGb > 0
        ? body.bandwidthLimitGb
        : 5; // 5 GB default
    const bandwidthLimitBytes = BigInt(Math.round(limitGb * BYTES_PER_GB));

    const validityDays =
      typeof body.validityDays === "number" && body.validityDays > 0
        ? Math.floor(body.validityDays)
        : DEFAULT_VALIDITY_DAYS; // 30 days default

    const now = new Date();
    const expiresAt = new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000);

    const created = await prisma.vdoCipherAccount.create({
      data: {
        name,
        apiKeyEnc,
        playerId: body.playerId ? body.playerId.trim() : null,
        bandwidthLimitBytes,
        bandwidthUsedBytes: BigInt(0),
        expiresAt,
        isActive: true,
        notes: body.notes ? body.notes.trim() : null,
      },
    });

    const publicAccount = await getAccountWithComputedStats(created, BigInt(0), 0);

    return NextResponse.json(
      {
        success: true,
        account: publicAccount,
        message: `تم إضافة حساب VdoCipher (${name}) بسعة ${limitGb}GB وصلاحية ${validityDays} يوماً بنجاح!`,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[Superadmin Create VdoCipher Account] Error:", error);
    return NextResponse.json(
      { error: error.message || "تعذر إضافة الحساب" },
      { status: 500 }
    );
  }
}
