import { prisma } from "@/lib/prisma";
import { SHA7NAWY_PENDING_TYPE } from "@/lib/sha7nawy";
import { SHAKEOUT_PENDING_TYPE } from "@/lib/shakeout";

interface RateRecord {
  count: number;
  resetAt: number;
}

class PaymentRateLimiter {
  private userMap = new Map<string, RateRecord>();
  private readonly windowMs = 60 * 60 * 1000; // 1 hour
  private readonly maxRequests = 10;           // 10 creations / hour

  public async checkRateLimit(userId: string): Promise<{ allowed: boolean; remaining: number; resetInSeconds: number }> {
    const now = Date.now();
    const record = this.userMap.get(userId);

    // First line of defense: in-memory fast check
    if (record && now <= record.resetAt && record.count >= this.maxRequests) {
      const resetInSeconds = Math.ceil((record.resetAt - now) / 1000);
      return { allowed: false, remaining: 0, resetInSeconds };
    }

    // Second line of defense (B25): DB check across serverless cold starts
    try {
      const oneHourAgo = new Date(now - this.windowMs);
      const dbCount = await prisma.balanceTransaction.count({
        where: {
          userId,
          type: { in: [SHA7NAWY_PENDING_TYPE, SHAKEOUT_PENDING_TYPE] },
          createdAt: { gte: oneHourAgo },
        },
      });

      if (dbCount >= this.maxRequests) {
        const oldestRecentTx = await prisma.balanceTransaction.findFirst({
          where: {
            userId,
            type: { in: [SHA7NAWY_PENDING_TYPE, SHAKEOUT_PENDING_TYPE] },
            createdAt: { gte: oneHourAgo },
          },
          orderBy: { createdAt: "asc" },
          select: { createdAt: true },
        });

        const resetAt = oldestRecentTx
          ? oldestRecentTx.createdAt.getTime() + this.windowMs
          : now + this.windowMs;
        const resetInSeconds = Math.max(1, Math.ceil((resetAt - now) / 1000));

        this.userMap.set(userId, { count: dbCount, resetAt });
        return { allowed: false, remaining: 0, resetInSeconds };
      }

      const count = Math.max((record?.count ?? 0) + 1, dbCount + 1);
      const resetAt = record && now <= record.resetAt ? record.resetAt : now + this.windowMs;
      this.userMap.set(userId, { count, resetAt });
      const remaining = Math.max(0, this.maxRequests - count);
      const resetInSeconds = Math.ceil((resetAt - now) / 1000);

      return { allowed: true, remaining, resetInSeconds };
    } catch {
      // Fallback to in-memory if DB query fails
      if (!record || now > record.resetAt) {
        this.userMap.set(userId, { count: 1, resetAt: now + this.windowMs });
        return { allowed: true, remaining: this.maxRequests - 1, resetInSeconds: 3600 };
      }
      record.count += 1;
      const remaining = Math.max(0, this.maxRequests - record.count);
      const resetInSeconds = Math.ceil((record.resetAt - now) / 1000);
      return { allowed: record.count <= this.maxRequests, remaining, resetInSeconds };
    }
  }

  public cleanup() {
    const now = Date.now();
    for (const [userId, record] of this.userMap.entries()) {
      if (now > record.resetAt) {
        this.userMap.delete(userId);
      }
    }
  }
}

export const paymentRateLimiter = new PaymentRateLimiter();

if (typeof setInterval !== "undefined") {
  setInterval(() => paymentRateLimiter.cleanup(), 15 * 60 * 1000);
}
