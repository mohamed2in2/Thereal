import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { whatsappOrchestrator } from "@/lib/whatsapp/orchestrator";
import { baileysProvider } from "@/lib/whatsapp/baileysProvider";
import { whatsappClient } from "@/lib/whatsapp/client";
import { regenerateParentToken, getAppBaseUrl } from "@/lib/whatsapp/parentToken";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "superadmin" && session.role !== "admin")) {
      return NextResponse.json({ error: "غير مصرح لك بالوصول" }, { status: 401 });
    }

    const { searchParams } = req.nextUrl;
    const exportFormat = searchParams.get("export"); // "csv" | "pdf"
    const search = searchParams.get("search") || "";
    const provider = searchParams.get("provider") || "";
    const status = searchParams.get("status") || "";
    const messageType = searchParams.get("messageType") || "";

    const overallStatus = await whatsappOrchestrator.getOverallStatus();

    // Query outgoing logs
    const where: any = {};
    if (search) {
      where.OR = [
        { recipient: { contains: search } },
        { content: { contains: search } },
      ];
    }
    if (provider) where.provider = provider;
    if (status) where.status = status;
    if (messageType) where.messageType = messageType;

    const logs = await prisma.whatsAppLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    // Handle CSV Export
    if (exportFormat === "csv") {
      const csvHeader = "ID,Timestamp,Recipient,Provider,MessageType,Status,DeliveryTimeMs,ErrorMessage\n";
      const csvRows = logs
        .map(
          (l) =>
            `"${l.id}","${l.createdAt.toISOString()}","${l.recipient}","${l.provider}","${l.messageType}","${l.status}","${l.deliveryTimeMs || 0}","${(l.errorMessage || "").replace(/"/g, '""')}"`
        )
        .join("\n");

      return new NextResponse(csvHeader + csvRows, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="whatsapp-logs-${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    }

    // Query configuration audit log
    const configLogs = await prisma.whatsAppConfigLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    return NextResponse.json({
      success: true,
      ...overallStatus,
      logs,
      configLogs,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "حدث خطأ داخلي" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "superadmin" && session.role !== "admin")) {
      return NextResponse.json({ error: "غير مصرح لك بالوصول" }, { status: 401 });
    }

    const body = await req.json();
    const { action } = body;

    // 1. Update Runtime Configuration
    if (action === "update-config") {
      const { deliveryMode, baileysOtpTemplate, autoSendParentPortal, requireParentVerification } = body;

      const currentConfig = await whatsappOrchestrator.getConfig();
      const updates: any = {};

      if (deliveryMode && deliveryMode !== currentConfig.deliveryMode) {
        updates.deliveryMode = deliveryMode;
        await logConfigChange(session.id, session.name, "deliveryMode", currentConfig.deliveryMode, deliveryMode);
      }
      if (baileysOtpTemplate !== undefined && baileysOtpTemplate !== currentConfig.baileysOtpTemplate) {
        updates.baileysOtpTemplate = baileysOtpTemplate;
        await logConfigChange(session.id, session.name, "baileysOtpTemplate", "Template updated", "New Template");
      }
      if (autoSendParentPortal !== undefined && autoSendParentPortal !== currentConfig.autoSendParentPortal) {
        updates.autoSendParentPortal = autoSendParentPortal;
        await logConfigChange(session.id, session.name, "autoSendParentPortal", String(currentConfig.autoSendParentPortal), String(autoSendParentPortal));
      }
      if (requireParentVerification !== undefined && requireParentVerification !== currentConfig.requireParentVerification) {
        updates.requireParentVerification = requireParentVerification;
        await logConfigChange(session.id, session.name, "requireParentVerification", String(currentConfig.requireParentVerification), String(requireParentVerification));
      }

      if (Object.keys(updates).length > 0) {
        await prisma.whatsAppConfig.upsert({
          where: { id: "global" },
          create: { id: "global", ...updates },
          update: updates,
        });
      }

      return NextResponse.json({ success: true, message: "تم تحديث الإعدادات وتسجيل السجل بنجاح" });
    }

    // 2. Test Send Message
    if (action === "test-send") {
      const { phone, content, messageType = "CUSTOM", providerOverride } = body;
      if (!phone || !content) {
        return NextResponse.json({ error: "رقم الهاتف ونص الرسالة مطلوبان" }, { status: 400 });
      }

      const result = await whatsappOrchestrator.sendMessage({
        recipient: phone,
        messageType: messageType as any,
        content,
      });

      return NextResponse.json({ success: result.success, result });
    }

    // 3. Reconnect Baileys Socket
    if (action === "reconnect") {
      await whatsappClient.reconnect();
      return NextResponse.json({ success: true, message: "جاري إعادة الاتصال بمحرك Baileys..." });
    }

    // 4. Logout Baileys Session
    if (action === "logout") {
      await whatsappClient.logout();
      await logConfigChange(session.id, session.name, "baileysSession", "ACTIVE", "LOGGED_OUT");
      return NextResponse.json({ success: true, message: "تم تسجيل الخروج ومسح بيانات الجلسة" });
    }

    // 5. Send Parent Portal Link manually
    if (action === "send-parent-link") {
      const { studentId } = body;
      const student = await prisma.user.findUnique({
        where: { id: studentId },
        select: { id: true, name: true, parentPhone: true },
      });

      if (!student || !student.parentPhone) {
        return NextResponse.json({ error: "الطالب أو رقم ولي الأمر غير موجود" }, { status: 400 });
      }

      const { rawToken } = await regenerateParentToken(studentId);
      const link = `${getAppBaseUrl()}/p/${rawToken}`;

      const res = await whatsappOrchestrator.sendParentPortalLink(student.parentPhone, student.name, link);

      return NextResponse.json({ success: res.success, result: res, link });
    }

    return NextResponse.json({ error: "إجراء غير معروف" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "حدث خطأ داخلي" }, { status: 500 });
  }
}

async function logConfigChange(adminId: string, adminName: string, key: string, oldVal: string | null, newVal: string | null) {
  try {
    await prisma.whatsAppConfigLog.create({
      data: {
        adminId,
        adminName,
        settingKey: key,
        oldValue: oldVal,
        newValue: newVal,
      },
    });
  } catch {}
}
