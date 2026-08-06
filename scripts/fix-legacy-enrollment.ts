/**
 * One-time fix: codes redeemed before the isActive enrollment fix were saved with isActive=false.
 * Run: npx ts-node --project tsconfig.json scripts/fix-legacy-enrollment.ts
 */
import { prisma } from "../src/lib/prisma";

async function main() {
  const result = await prisma.accessCode.updateMany({
    where: {
      studentId: { not: null },
      usedAt: { not: null },
      isActive: false,
    },
    data: { isActive: true },
  });
  console.log(`Updated ${result.count} legacy enrollment record(s) to isActive=true.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
