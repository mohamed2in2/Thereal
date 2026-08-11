import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/admin-auth";
import { DiscountService } from "@/services/discount/DiscountService";

/**
 * GET /api/admin/discount-codes
 * Lists all discount codes with usage counts and details (Superadmin only).
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "superadmin") {
      return NextResponse.json({ error: "غير مصرح — مخصص للإدارة العليا فقط" }, { status: 403 });
    }

    const discountCodes = await prisma.discountCode.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        _count: { select: { usages: true } },
        usages: {
          orderBy: { usedAt: "desc" },
          take: 5,
          include: {
            student: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    return NextResponse.json({ success: true, discountCodes });
  } catch (error) {
    console.error("[admin/discount-codes] GET error:", error);
    return NextResponse.json({ error: "حدث خطأ أثناء جلب أكواد الخصم" }, { status: 500 });
  }
}

/**
 * POST /api/admin/discount-codes
 * Creates a new discount code (Superadmin only).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "superadmin") {
      return NextResponse.json({ error: "غير مصرح — مخصص للإدارة العليا فقط" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      code,
      discountType,
      discountValue,
      scope = "PLATFORM_WIDE",
      targetId,
      expiresAt,
      maxTotalUses,
      maxUsesPerStudent = 1,
      allowedPaymentMethods,
    } = body;

    const cleanCode = DiscountService.normalizeCode(code);
    if (!cleanCode || cleanCode.length < 3) {
      return NextResponse.json({ error: "كود الخصم يجب أن يتكون من 3 أحرف/أرقام على الأقل" }, { status: 400 });
    }

    if (discountType !== "PERCENTAGE" && discountType !== "FIXED_AMOUNT") {
      return NextResponse.json({ error: "نوع الخصم يجب أن يكون نسبة مئوية (PERCENTAGE) أو مبلغ ثابت (FIXED_AMOUNT)" }, { status: 400 });
    }

    const numValue = Number(discountValue);
    if (!numValue || numValue <= 0) {
      return NextResponse.json({ error: "قيمة الخصم يجب أن تكون أكبر من صفر" }, { status: 400 });
    }

    if (discountType === "PERCENTAGE" && numValue > 100) {
      return NextResponse.json({ error: "نسبة الخصم المئوية لا يمكن أن تتجاوز 100%" }, { status: 400 });
    }

    const validScopes = ["PLATFORM_WIDE", "TEACHER", "COURSE", "FOLDER", "VIDEO", "PLAN"];
    if (!validScopes.includes(scope)) {
      return NextResponse.json({ error: "نطاق الخصم غير صالح" }, { status: 400 });
    }

    if (scope !== "PLATFORM_WIDE" && !targetId) {
      return NextResponse.json({ error: "يرجى تحديد العنصر المستهدف لنطاق الخصم المختار" }, { status: 400 });
    }

    // Check code uniqueness
    const existing = await prisma.discountCode.findUnique({ where: { code: cleanCode } });
    if (existing) {
      return NextResponse.json({ error: "كود الخصم هذا مستخدم بالفعل — يرجى اختيار كود آخر" }, { status: 409 });
    }

    // Prepare allowed payment methods JSON string
    let allowedMethodsJson: string | null = null;
    if (Array.isArray(allowedPaymentMethods) && allowedPaymentMethods.length > 0) {
      allowedMethodsJson = JSON.stringify(allowedPaymentMethods);
    }

    const created = await prisma.discountCode.create({
      data: {
        code: cleanCode,
        discountType,
        discountValue: numValue,
        scope,
        targetId: scope === "PLATFORM_WIDE" ? null : targetId,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        maxTotalUses: maxTotalUses ? Number(maxTotalUses) : null,
        maxUsesPerStudent: Math.max(1, Number(maxUsesPerStudent) || 1),
        allowedPaymentMethods: allowedMethodsJson,
        createdById: session.id,
      },
    });

    try {
      await logAdminAction({
        adminId: session.id,
        adminName: session.name,
        action: "CREATE_DISCOUNT_CODE",
        targetType: "DISCOUNT_CODE",
        targetId: created.id,
        targetName: created.code,
      });
    } catch {}

    return NextResponse.json({ success: true, discountCode: created }, { status: 201 });
  } catch (error) {
    console.error("[admin/discount-codes] POST error:", error);
    return NextResponse.json({ error: "حدث خطأ أثناء إنشاء كود الخصم" }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/discount-codes
 * Toggles active state or updates properties of a discount code (Superadmin only).
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "superadmin") {
      return NextResponse.json({ error: "غير مصرح — مخصص للإدارة العليا فقط" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { id, isActive, expiresAt, maxTotalUses, maxUsesPerStudent, allowedPaymentMethods } = body;

    if (!id) {
      return NextResponse.json({ error: "معرف كود الخصم مطلوب" }, { status: 400 });
    }

    const existing = await prisma.discountCode.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "كود الخصم غير موجود" }, { status: 404 });
    }

    const updateData: any = {};
    if (typeof isActive === "boolean") updateData.isActive = isActive;
    if (expiresAt !== undefined) updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;
    if (maxTotalUses !== undefined) updateData.maxTotalUses = maxTotalUses ? Number(maxTotalUses) : null;
    if (maxUsesPerStudent !== undefined) updateData.maxUsesPerStudent = Math.max(1, Number(maxUsesPerStudent) || 1);
    if (allowedPaymentMethods !== undefined) {
      updateData.allowedPaymentMethods = Array.isArray(allowedPaymentMethods) ? JSON.stringify(allowedPaymentMethods) : null;
    }

    const updated = await prisma.discountCode.update({
      where: { id },
      data: updateData,
    });

    try {
      await logAdminAction({
        adminId: session.id,
        adminName: session.name,
        action: "UPDATE_DISCOUNT_CODE",
        targetType: "DISCOUNT_CODE",
        targetId: updated.id,
        targetName: updated.code,
      });
    } catch {}

    return NextResponse.json({ success: true, discountCode: updated });
  } catch (error) {
    console.error("[admin/discount-codes] PATCH error:", error);
    return NextResponse.json({ error: "حدث خطأ أثناء تحديث كود الخصم" }, { status: 500 });
  }
}
