import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { POINTS } from "@/lib/points";

export type ReferralStatus = "PENDING" | "QUALIFIED" | "REWARDED" | "INVALID";

export class ReferralService {
  /**
   * Registers a new PENDING referral link when student B signs up using Student A's referral code.
   * Does NOT award any points on raw signup to prevent bot farming.
   */
  public static async registerPendingReferral(
    inviterId: string,
    invitedId: string,
    tx?: any
  ): Promise<boolean> {
    if (inviterId === invitedId) {
      console.warn(`[ReferralService] Rejected self-referral for user ${inviterId}`);
      return false;
    }

    const client = tx || prisma;
    try {
      await client.referral.create({
        data: {
          inviterId,
          invitedId,
          status: "PENDING",
        },
      });
      return true;
    } catch (err) {
      console.warn(`[ReferralService] User ${invitedId} already has a referral record.`);
      return false;
    }
  }

  /**
   * Qualifies and awards referral rewards (POINTS.REFERRAL to inviter & invited student)
   * upon a valid paid course purchase or access code redemption.
   * 
   * Atomically transitions status PENDING -> QUALIFIED -> REWARDED.
   */
  public static async qualifyAndRewardReferral(
    invitedStudentId: string,
    qualifyingPurchaseId: string,
    tx?: any
  ): Promise<{ rewarded: boolean; pointsAwarded: number }> {
    const execute = async (client: any) => {
      const referral = await client.referral.findUnique({
        where: { invitedId: invitedStudentId },
      });

      if (!referral) {
        return { rewarded: false, pointsAwarded: 0 };
      }

      // Must be in PENDING status and not previously rewarded
      if (referral.status !== "PENDING") {
        return { rewarded: false, pointsAwarded: 0 };
      }

      // Transition to REWARDED state atomically
      await client.referral.update({
        where: { id: referral.id },
        data: {
          status: "REWARDED",
          qualifyingPurchaseId,
          rewardedAt: new Date(),
        },
      });

      // Award POINTS.REFERRAL (+50 XP) to inviter & invited student
      const rewardPoints = POINTS.REFERRAL ?? 50;
      await client.user.update({
        where: { id: referral.inviterId },
        data: { points: { increment: rewardPoints }, pointsUpdatedAt: new Date() },
      });

      await client.user.update({
        where: { id: referral.invitedId },
        data: { points: { increment: rewardPoints }, pointsUpdatedAt: new Date() },
      });

      // Audit Log
      await client.auditLog.create({
        data: {
          userId: referral.invitedId,
          action: "REFERRAL_REWARDED",
          ip: "127.0.0.1",
          metadata: JSON.stringify({
            inviterId: referral.inviterId,
            invitedId: referral.invitedId,
            qualifyingPurchaseId,
            rewardPoints,
          }),
        },
      }).catch(() => {});

      console.log(`[ReferralService] Successfully rewarded ${rewardPoints} XP to inviter ${referral.inviterId} and invited ${referral.invitedId}`);

      return { rewarded: true, pointsAwarded: rewardPoints };
    };

    if (tx) {
      return execute(tx);
    }
    return prisma.$transaction(execute);
  }

  /**
   * Retrieves summary telemetry of referrals for admin security dashboard.
   */
  public static async getReferralTelemetry(): Promise<{
    pending: number;
    qualified: number;
    rewarded: number;
    invalid: number;
    total: number;
  }> {
    const [pending, qualified, rewarded, invalid, total] = await Promise.all([
      prisma.referral.count({ where: { status: "PENDING" } }),
      prisma.referral.count({ where: { status: "QUALIFIED" } }),
      prisma.referral.count({ where: { status: "REWARDED" } }),
      prisma.referral.count({ where: { status: "INVALID" } }),
      prisma.referral.count(),
    ]);

    return { pending, qualified, rewarded, invalid, total };
  }
}
