import { RateLimiter } from "../../gateway/RateLimiter";

export class AdvancedRateLimiter {
  private rateLimiter: RateLimiter;

  constructor() {
    this.rateLimiter = new RateLimiter();
  }

  public checkMultiTierRateLimit(
    userId: string,
    userRole: string,
    grade = "sec_1"
  ): { allowed: boolean; reason?: string } {
    // 1. User level check (60/min)
    const userCheck = this.rateLimiter.checkRateLimit(`user_${userId}`, 60);
    if (!userCheck.allowed) {
      return { allowed: false, reason: "معدل الطلبات الفردية تجاوز الحد المسموح به في الدقيقة." };
    }

    // 2. Grade level global check (1000/min)
    const gradeCheck = this.rateLimiter.checkRateLimit(`grade_${grade}`, 1000);
    if (!gradeCheck.allowed) {
      return { allowed: false, reason: "معدل الطلبات لهذه المرحلة الدراسية شهد ارتفاعاً استثنائياً." };
    }

    return { allowed: true };
  }
}
