/**
 * create-admin.mjs — one-time script to create an admin or staff account
 * Usage:
 *   node --import dotenv/config scripts/create-admin.mjs <email> <password> <name> [role=admin|staff]
 * Example:
 *   node --import dotenv/config scripts/create-admin.mjs admin@school.com MyPass123 "أحمد محمد" admin
 *
 * Delete this script after use or keep it out of version control.
 */
import { createRequire } from "node:module";
import bcrypt from "bcryptjs";
const require = createRequire(import.meta.url);
require("dotenv/config");

const [,, email, password, name, role = "admin"] = process.argv;

if (!email || !password || !name) {
  console.error("Usage: node --import dotenv/config scripts/create-admin.mjs <email> <password> <name> [admin|staff]");
  process.exit(1);
}
if (!["admin", "staff"].includes(role)) {
  console.error("Role must be 'admin' or 'staff'");
  process.exit(1);
}

const { createClient } = await import("@libsql/client");
const db = createClient({ url: process.env.DATABASE_URL ?? "file:./dev.db" });

// Check if email already exists
const existing = await db.execute({ sql: "SELECT id, role FROM User WHERE email = ?", args: [email] });
if (existing.rows.length > 0) {
  console.error(`Email '${email}' already exists in DB (role=${existing.rows[0][1]}). Aborting.`);
  db.close(); process.exit(1);
}

const hash = await bcrypt.hash(password, 12);
const id   = `${role}_${Date.now()}`;
const now  = new Date().toISOString();

await db.execute({
  sql: `INSERT INTO User
          (id, name, email, password, role, isActive, isDeleted, profileCompleted, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, 1, 0, 1, ?, ?)`,
  args: [id, name.trim(), email.trim().toLowerCase(), hash, role, now, now],
});

console.log(`\n✓ Created ${role} account:`);
console.log("  id    :", id);
console.log("  name  :", name.trim());
console.log("  email :", email.trim().toLowerCase());
console.log("  role  :", role);
console.log("\nYou can now log in at /adminpanel using the 'مشرف / موظف' tab.\n");
db.close();
