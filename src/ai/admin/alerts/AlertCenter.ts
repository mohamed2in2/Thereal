import { BudgetAlerts } from "../budget/BudgetAlerts";
import { ProviderMonitor } from "../monitoring/ProviderMonitor";

export type AlertSeverity = "Info" | "Warning" | "Error" | "Critical";
export type AlertCategory =
  | "Budget" | "Provider" | "Quota" | "Auth" | "Latency"
  | "Cache" | "Token" | "Security" | "Abuse" | "Key";

export interface SystemAlert {
  id: string;
  severity: AlertSeverity;
  category: AlertCategory;
  title: string;
  message: string;
  timestamp: string;
  resolved: boolean;
  resolvedAt?: string;
  metadata?: Record<string, unknown>;
}

export class AlertCenter {
  private static instance: AlertCenter;
  private alerts: SystemAlert[] = [];
  private readonly MAX_ALERTS = 500;

  public static getInstance(): AlertCenter {
    if (!AlertCenter.instance) {
      AlertCenter.instance = new AlertCenter();
    }
    return AlertCenter.instance;
  }

  public emit(params: Omit<SystemAlert, "id" | "timestamp" | "resolved">): SystemAlert {
    const alert: SystemAlert = {
      ...params,
      id: `alt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      resolved: false,
    };

    this.alerts.push(alert);
    if (this.alerts.length > this.MAX_ALERTS) this.alerts.shift();

    const emoji = { Info: "ℹ️", Warning: "⚠️", Error: "🔴", Critical: "🚨" }[params.severity];
    console.warn(`[AlertCenter] ${emoji} [${params.category}] ${params.title}: ${params.message}`);
    return alert;
  }

  public resolve(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) { alert.resolved = true; alert.resolvedAt = new Date().toISOString(); }
  }

  public getAlerts(opts: { limit?: number; unresolved?: boolean; category?: AlertCategory; severity?: AlertSeverity } = {}): SystemAlert[] {
    let results = [...this.alerts];
    if (opts.unresolved) results = results.filter(a => !a.resolved);
    if (opts.category) results = results.filter(a => a.category === opts.category);
    if (opts.severity) results = results.filter(a => a.severity === opts.severity);
    return results.slice(-(opts.limit ?? 50)).reverse();
  }

  public getUnresolvedCount(): number { return this.alerts.filter(a => !a.resolved).length; }

  // ── Convenience helpers ────────────────────────────────────────────

  public alertProviderOffline(providerId: string): void {
    this.emit({ severity: "Critical", category: "Provider", title: `المزوّد ${providerId} غير متاح`, message: `المزوّد ${providerId} أصبح غير متاح. يُرجى التحقق من الإعدادات.` });
  }

  public alertRateLimit(providerId: string, count: number): void {
    this.emit({ severity: "Warning", category: "Quota", title: `تحذير: Rate Limit — ${providerId}`, message: `تجاوز عدد أخطاء 429 الحد المقبول (${count} مرة). قد يتوقف البوتسبوت.` });
  }

  public alertAuthFailed(providerId: string, keyId: string): void {
    this.emit({ severity: "Error", category: "Auth", title: `مفتاح API غير صالح — ${providerId}`, message: `المفتاح ${keyId} أعطى 401. تم تعطيله تلقائياً.`, metadata: { keyId } });
  }

  public alertHighLatency(providerId: string, avgMs: number): void {
    this.emit({ severity: "Warning", category: "Latency", title: `بطء في الاستجابة — ${providerId}`, message: `متوسط الاستجابة ${avgMs}ms. النظام يتباطأ.` });
  }

  public alertTokenExplosion(studentId: string, tokens: number): void {
    this.emit({ severity: "Warning", category: "Token", title: `انفجار توكنات — طالب ${studentId}`, message: `الطالب استهلك ${tokens.toLocaleString()} توكن في وقت قصير.`, metadata: { studentId, tokens } });
  }

  public alertSecurityThreat(type: "prompt_injection" | "jailbreak", studentId: string): void {
    const labels = { prompt_injection: "Prompt Injection", jailbreak: "Jailbreak Attempt" };
    this.emit({ severity: "Critical", category: "Security", title: `تهديد أمني: ${labels[type]}`, message: `تم رصد محاولة ${labels[type]} من الطالب ${studentId}.`, metadata: { studentId, type } });
  }

  public alertStudentAbuse(studentId: string, requestCount: number): void {
    this.emit({ severity: "Warning", category: "Abuse", title: `استخدام مفرط — طالب ${studentId}`, message: `الطالب أرسل ${requestCount} طلب في الدقيقة الأخيرة.`, metadata: { studentId, requestCount } });
  }

  public alertBudgetThreshold(level: string, usagePercent: number): void {
    const severityMap: Record<string, AlertSeverity> = { Warning: "Warning", Economy: "Warning", Degraded: "Error", Critical: "Critical", Emergency: "Critical" };
    this.emit({ severity: severityMap[level] ?? "Warning", category: "Budget", title: `الميزانية وصلت ${usagePercent}% — وضع ${level}`, message: `تم استهلاك ${usagePercent}% من الميزانية اليومية.`, metadata: { level, usagePercent } });
  }
}
