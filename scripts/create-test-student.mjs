/**
 * One-off admin utility: create/refresh a test STUDENT account in the local
 * SQLite DB (prisma/dev.db) via the libSQL adapter — the same way the app and
 * the repair script connect, so the row lands in the DB the app actually reads.
 * Idempotent (upsert by email). Reads DATABASE_URL from .env.
 *
 *   npx tsx scripts/create-test-student.mjs
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import bcrypt from "bcryptjs";

const STUDENT = {
  name: "طالب تجريبي",
  email: "test.student@codeup.tech",
  phoneLogin: "01010101010",
  phoneStored: "+201010101010",
  parentPhone: "+201010101011",
  password: "Student@1234",
  age: 17,
  stage: "sec_3",
};

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.startsWith("file:") && !url.startsWith("libsql:")) {
    throw new Error(`Expected sqlite/libsql DATABASE_URL for local; got: ${url.slice(0, 18)}`);
  }

  const prisma = new PrismaClient({ adapter: new PrismaLibSql({ url }) });
  const hash = await bcrypt.hash(STUDENT.password, 10);

  const base = {
    name: STUDENT.name,
    phone: STUDENT.phoneStored,
    parentPhone: STUDENT.parentPhone,
    age: STUDENT.age,
    educationalStage: STUDENT.stage,
    role: "student",
    isActive: true,
    isDeleted: false,
    profileCompleted: true,
  };

  const student = await prisma.user.upsert({
    where: { email: STUDENT.email },
    update: { ...base, password: hash },
    create: { ...base, email: STUDENT.email, password: hash },
  });

  const total = await prisma.user.count();
  await prisma.$disconnect();

  console.log("✅ Test student ready:", {
    id: student.id,
    email: student.email,
    phone: student.phone,
    role: student.role,
    profileCompleted: student.profileCompleted,
  });
  console.log("   total users in DB:", total);
  console.log("\n— Login at /login —");
  console.log("  Phone:   ", STUDENT.phoneLogin);
  console.log("  Password:", STUDENT.password);
}

main().catch((e) => {
  console.error("❌ Failed:", e.message);
  process.exit(1);
});
