import { prisma } from "../src/lib/prisma";
import { getShakeOutPaymentInfo, SHAKEOUT_PAID_STATUSES, SHAKEOUT_CREDITED_TYPE } from "../src/lib/shakeout";
import { fulfillPendingItemPurchase } from "../src/lib/fulfillment";

async function main() {
  console.log("================================================================================");
  console.log("🔍 Checking and Reconciling Shake-Out Transaction: dEB966yJoW / qiXmOqwMsLcri0iU");
  console.log("================================================================================");

  // 1. Find transaction in DB
  const tx = await prisma.balanceTransaction.findFirst({
    where: {
      OR: [
        { providerRef: { contains: "dEB966yJoW" } },
        { providerRef: { contains: "qiXmOqwMsLcri0iU" } },
        { note: { contains: "dEB966yJoW" } },
        { note: { contains: "qiXmOqwMsLcri0iU" } },
      ],
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          balance: true,
        },
      },
    },
  });

  if (!tx) {
    console.log("❌ No transaction found in database matching dEB966yJoW or qiXmOqwMsLcri0iU.");
    
    // List latest 5 transactions
    const recent = await prisma.balanceTransaction.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { user: { select: { name: true, phone: true } } },
    });
    console.log("\nRecent 5 transactions in database:");
    console.log(JSON.stringify(recent, null, 2));
    return;
  }

  console.log("✅ Found Transaction in Database:");
  console.log(`- ID: ${tx.id}`);
  console.log(`- Type: ${tx.type}`);
  console.log(`- Amount: ${tx.amount} EGP`);
  console.log(`- User: ${tx.user.name} (${tx.user.phone || tx.user.email}) - Current Balance: ${tx.user.balance} EGP`);
  console.log(`- ProviderRef: ${tx.providerRef}`);
  console.log(`- Note: ${tx.note}`);
  console.log(`- Created At: ${tx.createdAt}`);

  // 2. Query Shake-Out Gateway API
  const searchRef = tx.providerRef || "dEB966yJoW/qiXmOqwMsLcri0iU";
  console.log(`\n🌐 Querying Shake-Out API for ref: ${searchRef}...`);
  
  const gatewayInfo = await getShakeOutPaymentInfo(searchRef);
  console.log("Shake-Out Gateway Response:", JSON.stringify(gatewayInfo, null, 2));

  const normalizedStatus = (gatewayInfo.data?.status || "unknown").toString().toLowerCase();
  const isPaid = SHAKEOUT_PAID_STATUSES.includes(normalizedStatus) || gatewayInfo.data?.status === "paid";

  console.log(`\nNormalized Status: "${normalizedStatus}" | Is Paid: ${isPaid}`);

  // 3. Reconcile if paid or force reconcile if user confirmed payment
  if (tx.type.includes("pending") || tx.type.includes("expired")) {
    if (isPaid || process.argv.includes("--force")) {
      console.log("\n⚡ Reconciling and fulfilling transaction...");

      const processed = await prisma.$transaction(async (dbTx: any) => {
        const claim = await dbTx.balanceTransaction.updateMany({
          where: { id: tx.id, type: tx.type },
          data: {
            type: SHAKEOUT_CREDITED_TYPE,
            note: `${tx.note} — سداد وتأكيد فوري عبر Shake-Out`,
          },
        });

        if (claim.count === 0) {
          console.log("Transaction was already claimed by another process.");
          return false;
        }

        await dbTx.user.update({
          where: { id: tx.userId },
          data: { balance: { increment: tx.amount } },
        });

        const fulfillmentRes = await fulfillPendingItemPurchase({
          userId: tx.userId,
          note: tx.note,
          tx: dbTx,
        });

        return fulfillmentRes;
      });

      console.log("\n🎉 Fulfillment Result:", JSON.stringify(processed, null, 2));

      const updatedUser = await prisma.user.findUnique({
        where: { id: tx.userId },
        select: {
          id: true,
          name: true,
          balance: true,
          teacherSubscriptions: {
            where: { status: "active" },
            select: { id: true, planType: true, expiresAt: true, teacherId: true },
          },
          courseEnrollments: {
            select: { courseId: true, course: { select: { title: true } } },
          },
        },
      });

      console.log("\n✅ Student Profile After Fulfillment:");
      console.log(JSON.stringify(updatedUser, null, 2));
    } else {
      console.log("\n⚠️ Gateway did not report paid status yet.");
    }
  } else {
    console.log("\nℹ️ Transaction is already marked as completed/credited in database.");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
