import dotenv from "dotenv";
dotenv.config();
const { prisma } = await import("../src/lib/prisma.ts");

const codes = await prisma.accessCode.findMany({
  include: {
    student: { select: { id: true, name: true, role: true } },
    course: { select: { title: true } },
  },
});
console.log(JSON.stringify(codes, null, 2));
await prisma.$disconnect();
