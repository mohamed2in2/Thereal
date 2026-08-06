import { prisma } from "@/lib/prisma";
import { WhatsAppProvider, MessageType, SendMessageParams, SendResult, ProviderId } from "./providerInterface";
import { baileysProvider } from "./baileysProvider";
import { officialMetaProvider } from "./officialMetaProvider";

export type DeliveryMode = "baileys_only" | "official_only" | "baileys_primary" | "official_primary";

export const DEFAULT_OTP_TEMPLATE = `🔐 Code-UP

مرحباً {{studentName}}

رمز التحقق الخاص بك هو:

{{otp}}

هذا الرمز صالح لمدة {{minutes}} دقائق.

يرجى عدم مشاركة هذا الرمز مع أي شخص.

شكراً لاستخدام منصة Code-UP.`;

class WhatsAppOrchestrator {
  private providers: Record<ProviderId, WhatsAppProvider> = {
    BAILEYS: baileysProvider,
    OFFICIAL_API: officialMetaProvider,
  };

  /**
   * Fetch current WhatsApp runtime configuration from DB (with caching / fallback)
   */
  public async getConfig() {
    try {
      let config = await prisma.whatsAppConfig.findUnique({ where: { id: "global" } });
      if (!config) {
        config = await prisma.whatsAppConfig.create({
          data: {
            id: "global",
            deliveryMode: "baileys_primary",
            baileysOtpTemplate: DEFAULT_OTP_TEMPLATE,
            autoSendParentPortal: true,
            requireParentVerification: false,
          },
        });
      }
      return config;
    } catch {
      return {
        id: "global",
        deliveryMode: "baileys_primary" as DeliveryMode,
        baileysOtpTemplate: DEFAULT_OTP_TEMPLATE,
        autoSendParentPortal: true,
        requireParentVerification: false,
      };
    }
  }

  /**
   * Dispatches a message using the configured delivery strategy & failover rules
   */
  public async sendMessage(params: SendMessageParams): Promise<SendResult> {
    const config = await this.getConfig();
    const mode = (config.deliveryMode || "baileys_primary") as DeliveryMode;

    let primary: ProviderId = "BAILEYS";
    let fallback: ProviderId | null = "OFFICIAL_API";

    if (mode === "baileys_only") {
      primary = "BAILEYS";
      fallback = null;
    } else if (mode === "official_only") {
      primary = "OFFICIAL_API";
      fallback = null;
    } else if (mode === "official_primary") {
      primary = "OFFICIAL_API";
      fallback = "BAILEYS";
    } else {
      // default: baileys_primary
      primary = "BAILEYS";
      fallback = "OFFICIAL_API";
    }

    let retries = 0;

    // Try Primary Provider
    let result = await this.providers[primary].sendMessage(params);

    // Automatic Failover if Primary Failed & Fallback Exists
    if (!result.success && fallback) {
      retries += 1;
      result = await this.providers[fallback].sendMessage(params);
    }

    // Record audit log & update daily metrics asynchronously
    this.recordAuditAndMetrics(params, result, retries).catch(() => {});

    return result;
  }

  /**
   * Format OTP text using DB template or fallback
   */
  public async formatOTP(
    studentName: string,
    otp: string,
    minutes: number = 5,
    school: string = "Code-UP",
    supportNumber: string = "01012345678"
  ): Promise<string> {
    const config = await this.getConfig();
    let template = config.baileysOtpTemplate || DEFAULT_OTP_TEMPLATE;

    return template
      .replace(/{{studentName}}/g, studentName || "عزيزي الطالب")
      .replace(/{{otp}}/g, otp)
      .replace(/{{minutes}}/g, String(minutes))
      .replace(/{{expirationTime}}/g, `${minutes} دقائق`)
      .replace(/{{school}}/g, school)
      .replace(/{{platform}}/g, school)
      .replace(/{{supportNumber}}/g, supportNumber);
  }

  /**
   * Helper to send OTP directly
   */
  public async sendOTP(recipient: string, otpCode: string, studentName: string = "الطالب"): Promise<SendResult> {
    const formattedContent = await this.formatOTP(studentName, otpCode, 5, "Code-UP");
    return this.sendMessage({
      recipient,
      messageType: "OTP",
      content: formattedContent,
      templateVariables: {
        studentName,
        otp: otpCode,
        minutes: "5",
        school: "Code-UP",
      },
    });
  }

  /**
   * Helper to send Parent Portal link directly
   */
  public async sendParentPortalLink(recipient: string, studentName: string, portalUrl: string): Promise<SendResult> {
    const content = `👨‍👩‍👧‍👦 ولي أمر الطالب ${studentName} المحترم،

إليك رابط متابعة المستوى الدراسي والنتائج الحية لنجلك على منصة Code-UP:

🔗 ${portalUrl}

هذا الرابط مخصص لولي الأمر ومتاح طوال العام بدون الحاجة لتسجيل دخول.

مع تحيات إدارة Code-UP.`;

    return this.sendMessage({
      recipient,
      messageType: "PARENT_LINK",
      content,
      templateVariables: {
        studentName,
        portalUrl,
      },
    });
  }

  /**
   * Get all provider statuses and health metrics
   */
  public async getOverallStatus() {
    const config = await this.getConfig();
    const baileysStatus = this.providers.BAILEYS.getStatus();
    const metaStatus = this.providers.OFFICIAL_API.getStatus();

    const todayDate = new Date().toISOString().split("T")[0];

    // Fetch daily metrics from DB
    const dailyMetrics = await prisma.whatsAppDailyCounter.findMany({
      where: { date: todayDate },
    });

    const baileysDaily = dailyMetrics.find((m) => m.provider === "BAILEYS") || {
      totalCount: 0,
      deliveredCount: 0,
      failedCount: 0,
      pendingCount: 0,
      otpCount: 0,
      parentCount: 0,
    };

    const metaDaily = dailyMetrics.find((m) => m.provider === "OFFICIAL_API") || {
      totalCount: 0,
      deliveredCount: 0,
      failedCount: 0,
      pendingCount: 0,
      authCount: 0,
      utilityCount: 0,
      marketingCount: 0,
    };

    return {
      activeDeliveryMode: config.deliveryMode,
      autoSendParentPortal: config.autoSendParentPortal,
      requireParentVerification: config.requireParentVerification,
      baileysOtpTemplate: config.baileysOtpTemplate || DEFAULT_OTP_TEMPLATE,
      providers: {
        baileys: baileysStatus,
        officialApi: metaStatus,
      },
      dailyUsage: {
        date: todayDate,
        baileys: baileysDaily,
        officialApi: metaDaily,
      },
    };
  }

  /**
   * Audit log & daily metric increment
   */
  private async recordAuditAndMetrics(params: SendMessageParams, result: SendResult, retries: number) {
    const todayDate = new Date().toISOString().split("T")[0];
    const statusStr = result.success ? "DELIVERED" : "FAILED";

    // 1. Save to WhatsAppLog
    await prisma.whatsAppLog.create({
      data: {
        recipient: params.recipient,
        provider: result.provider,
        messageType: params.messageType,
        templateName: params.templateName || null,
        content: params.content,
        status: statusStr,
        retries,
        deliveryTimeMs: result.deliveryTimeMs || null,
        errorMessage: result.error || null,
      },
    });

    // 2. Increment Daily Counter
    const isOtp = params.messageType === "OTP";
    const isParent = params.messageType === "PARENT_LINK";

    await prisma.whatsAppDailyCounter.upsert({
      where: {
        date_provider: {
          date: todayDate,
          provider: result.provider,
        },
      },
      create: {
        date: todayDate,
        provider: result.provider,
        totalCount: 1,
        deliveredCount: result.success ? 1 : 0,
        failedCount: result.success ? 0 : 1,
        otpCount: isOtp ? 1 : 0,
        parentCount: isParent ? 1 : 0,
        authCount: isOtp ? 1 : 0,
        utilityCount: isParent ? 1 : 0,
      },
      update: {
        totalCount: { increment: 1 },
        deliveredCount: result.success ? { increment: 1 } : undefined,
        failedCount: result.success ? undefined : { increment: 1 },
        otpCount: isOtp ? { increment: 1 } : undefined,
        parentCount: isParent ? { increment: 1 } : undefined,
        authCount: isOtp ? { increment: 1 } : undefined,
        utilityCount: isParent ? { increment: 1 } : undefined,
      },
    });
  }
}

export const whatsappOrchestrator = new WhatsAppOrchestrator();
