import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  try {
    const errors = await prisma.clientError.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    console.log("Latest reported errors:");
    console.dir(errors, { depth: null });
  } catch (err) {
    console.error("Failed to query errors:", err);
  }
}

main().finally(() => prisma.$disconnect());
