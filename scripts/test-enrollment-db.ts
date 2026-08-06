/**
 * DB-level test: simulates student enrollment query used by library API
 * Run: npx ts-node --project tsconfig.json scripts/test-enrollment-db.ts
 */
import { prisma } from "../src/lib/prisma";

async function main() {
  const students = await prisma.user.findMany({
    where: { role: "student" },
    select: { id: true, name: true, email: true },
    take: 5,
  });

  console.log("Students:", students.length);

  for (const student of students) {
    const codes = await prisma.accessCode.findMany({
      where: { studentId: student.id },
      include: { course: { select: { title: true } } },
    });

    const enrolled = await prisma.course.findMany({
      where: {
        accessCodes: { some: { studentId: student.id } },
      },
      select: { id: true, title: true },
    });

    console.log(`\n${student.name} (${student.email})`);
    console.log(`  access codes bound: ${codes.length}`);
    codes.forEach((c) =>
      console.log(`    - ${c.code} → ${c.course.title} active=${c.isActive} usedAt=${c.usedAt?.toISOString() ?? "null"}`)
    );
    console.log(`  library query courses: ${enrolled.length}`);
    enrolled.forEach((c) => console.log(`    - ${c.title}`));
  }

  const orphanTeacherCodes = await prisma.accessCode.findMany({
    where: {
      student: { role: { in: ["teacher", "superadmin"] } },
    },
    include: { student: { select: { name: true, role: true } }, course: { select: { title: true } } },
  });
  if (orphanTeacherCodes.length) {
    console.log("\n⚠ Codes bound to TEACHER accounts (won't show in student library):");
    orphanTeacherCodes.forEach((c) =>
      console.log(`  ${c.code} → ${c.course.title} as ${c.student?.role} ${c.student?.name}`)
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
