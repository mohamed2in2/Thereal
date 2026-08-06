/**
 * seed-superadmins.mjs — create the four named superadmins.
 *
 *   Ahmed  → owner (isOwner=true): can manage the other superadmins, maintenance
 *            mode, and virtual data.
 *   Mohamed, Adham, Yassen → regular superadmins.
 *
 * Idempotent: upserts by email. On re-run it refreshes name/role/isOwner but
 * NEVER overwrites an existing password (so passwords changed in the UI stick).
 * New accounts get a temporary password — change it immediately in the panel,
 * or override per-account via env (AHMED_PASSWORD, MOHAMED_PASSWORD, …).
 *
 * Works locally (SQLite/libSQL) and in production (Postgres), same as the app.
 *
 *   node --import dotenv/config scripts/seed-superadmins.mjs
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";

const SUPERADMINS = [
  { name: "Ahmed", email: "ahmed@code-up.tech", isOwner: true, envKey: "AHMED_PASSWORD" },
  { name: "Mohamed", email: "mohamed@code-up.tech", isOwner: false, envKey: "MOHAMED_PASSWORD" },
  { name: "Adham", email: "adham@code-up.tech", isOwner: false, envKey: "ADHAM_PASSWORD" },
  { name: "Yassen", email: "yassen@code-up.tech", isOwner: false, envKey: "YASSEN_PASSWORD" },
];

async function makeClient() {
  const url = process.env.DATABASE_URL ?? "";
  if (url.startsWith("file:") || url.startsWith("libsql:")) {
    const { PrismaLibSql } = await import("@prisma/adapter-libsql");
    const adapter = new PrismaLibSql({ url });
    return new PrismaClient({ adapter });
  }
  return new PrismaClient();
}

async function main() {
  const prisma = await makeClient();
  try {
    for (const sa of SUPERADMINS) {
      const tempPassword = process.env[sa.envKey] || `ChangeMe-${sa.name}-2026`;
      const existing = await prisma.user.findUnique({ where: { email: sa.email } });

      if (existing) {
        await prisma.user.update({
          where: { email: sa.email },
          data: {
            name: sa.name,
            role: "superadmin",
            isOwner: sa.isOwner,
            isActive: true,
            isDeleted: false,
            profileCompleted: true,
          },
        });
        console.log(`↻ updated ${sa.name} (${sa.email}) — password unchanged`);
      } else {
        await prisma.user.create({
          data: {
            name: sa.name,
            email: sa.email,
            password: await bcrypt.hash(tempPassword, 12),
            role: "superadmin",
            isOwner: sa.isOwner,
            isActive: true,
            isDeleted: false,
            profileCompleted: true,
          },
        });
        console.log(`✓ created ${sa.name} (${sa.email}) — temp password: ${tempPassword}`);
      }
    }
    console.log("\nDone. Log in at /adminpanel → المشرف العام, using a superadmin's password.");
    console.log("Master password (SUPERADMIN_MASTER_PASSWORD) still works as break-glass owner.\n");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
