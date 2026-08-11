import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_TESTER_CAPABILITIES } from "@/lib/tester";
import { logAdminAction } from "@/lib/admin-auth";

// GET /api/admin/superadmin/testers/[id] — get tester details + recent activity logs
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || session.role !== "superadmin") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { id } = await params;
    const tester = await prisma.user.findFirst({
      where: { id, accountMode: "TESTER", isDeleted: false },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        accountMode: true,
        testerCapabilities: true,
        testerNotes: true,
        isActive: true,
        createdAt: true,
        testerActivityLogs: {
          take: 50,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!tester) {
      return NextResponse.json({ error: "حساب الفحص غير موجود" }, { status: 404 });
    }

    let capabilities = { ...DEFAULT_TESTER_CAPABILITIES };
    try {
      if (tester.testerCapabilities) {
        capabilities = { ...capabilities, ...JSON.parse(tester.testerCapabilities) };
      }
    } catch {}

    return NextResponse.json({
      tester: {
        ...tester,
        capabilities,
      },
    });
  } catch (err) {
    console.error("GET /api/admin/superadmin/testers/[id] error:", err);
    return NextResponse.json({ error: "حدث خطأ في الخادم" }, { status: 500 });
  }
}

// PATCH /api/admin/superadmin/testers/[id] — update tester capabilities, notes, password, or status
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || session.role !== "superadmin") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { id } = await params;
    const body = (await req.json()) as {
      name?: string;
      notes?: string;
      capabilities?: Record<string, boolean>;
      isActive?: boolean;
      password?: string;
    };

    const tester = await prisma.user.findFirst({
      where: { id, accountMode: "TESTER", isDeleted: false },
    });

    if (!tester) {
      return NextResponse.json({ error: "حساب الفحص غير موجود" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.notes !== undefined) updateData.testerNotes = body.notes.trim();
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    if (body.capabilities !== undefined) {
      let currentCaps = { ...DEFAULT_TESTER_CAPABILITIES };
      try {
        if (tester.testerCapabilities) {
          currentCaps = { ...currentCaps, ...JSON.parse(tester.testerCapabilities) };
        }
      } catch {}
      const mergedCaps = { ...currentCaps, ...body.capabilities };
      updateData.testerCapabilities = JSON.stringify(mergedCaps);
    }

    if (body.password) {
      if (body.password.length < 6) {
        return NextResponse.json({ error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" }, { status: 400 });
      }
      updateData.password = await bcrypt.hash(body.password, 12);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        accountMode: true,
        testerCapabilities: true,
        testerNotes: true,
        isActive: true,
        createdAt: true,
      },
    });

    await logAdminAction({
      adminId: session.id,
      adminName: session.name,
      action: "UPDATE_TESTER_ACCOUNT",
      targetType: "TesterAccount",
      targetId: updated.id,
      targetName: updated.name,
      metadata: { updateKeys: Object.keys(updateData) },
    });

    let capabilities = { ...DEFAULT_TESTER_CAPABILITIES };
    try {
      if (updated.testerCapabilities) {
        capabilities = { ...capabilities, ...JSON.parse(updated.testerCapabilities) };
      }
    } catch {}

    return NextResponse.json({
      success: true,
      tester: {
        ...updated,
        capabilities,
      },
    });
  } catch (err) {
    console.error("PATCH /api/admin/superadmin/testers/[id] error:", err);
    return NextResponse.json({ error: "حدث خطأ في الخادم" }, { status: 500 });
  }
}

// DELETE /api/admin/superadmin/testers/[id] — soft delete tester account
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || session.role !== "superadmin") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { id } = await params;
    const tester = await prisma.user.findFirst({
      where: { id, accountMode: "TESTER" },
    });

    if (!tester) {
      return NextResponse.json({ error: "حساب الفحص غير موجود" }, { status: 404 });
    }

    await prisma.user.update({
      where: { id },
      data: { isDeleted: true, isActive: false },
    });

    await logAdminAction({
      adminId: session.id,
      adminName: session.name,
      action: "DELETE_TESTER_ACCOUNT",
      targetType: "TesterAccount",
      targetId: tester.id,
      targetName: tester.name,
    });

    return NextResponse.json({ success: true, message: "تم حذف حساب الفحص بنجاح" });
  } catch (err) {
    console.error("DELETE /api/admin/superadmin/testers/[id] error:", err);
    return NextResponse.json({ error: "حدث خطأ في الخادم" }, { status: 500 });
  }
}
