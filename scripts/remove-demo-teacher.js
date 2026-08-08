/* eslint-disable @typescript-eslint/no-require-imports */
require("dotenv").config();
const { createClient } = require("@libsql/client");

const client = createClient({ url: process.env.DATABASE_URL || "file:./prisma/dev.db" });

async function main() {
  console.log("🧹 Starting Demo Teacher Teardown via @libsql/client...");

  const demoTeacherRes = await client.execute({
    sql: "SELECT id FROM User WHERE isDemo = 1 AND role = 'teacher'",
    args: [],
  });

  if (demoTeacherRes.rows.length === 0) {
    console.log("ℹ️ No demo teacher found in database.");
    return;
  }

  const teacherId = String(demoTeacherRes.rows[0].id);

  const demoStudentsRes = await client.execute({
    sql: "SELECT id FROM User WHERE isDemo = 1 AND role = 'student'",
    args: [],
  });
  const studentIds = demoStudentsRes.rows.map((r) => String(r.id));

  const demoCoursesRes = await client.execute({
    sql: "SELECT id FROM Course WHERE teacherId = ?",
    args: [teacherId],
  });
  const courseIds = demoCoursesRes.rows.map((r) => String(r.id));

  // Perform cascading deletions
  let deletedCount = 0;

  if (studentIds.length > 0) {
    const sPlaceholders = studentIds.map(() => "?").join(",");
    const pt = await client.execute({ sql: `DELETE FROM ParentToken WHERE studentId IN (${sPlaceholders})`, args: studentIds });
    const pve = await client.execute({ sql: `DELETE FROM ParentVerificationEvent WHERE studentId IN (${sPlaceholders})`, args: studentIds });
    const sub = await client.execute({ sql: `DELETE FROM HomeworkSubmission WHERE studentId IN (${sPlaceholders})`, args: studentIds });
    const qr = await client.execute({ sql: `DELETE FROM QuizResult WHERE studentId IN (${sPlaceholders})`, args: studentIds });
    const fp = await client.execute({ sql: `DELETE FROM FolderPurchase WHERE studentId IN (${sPlaceholders})`, args: studentIds });
    const vp = await client.execute({ sql: `DELETE FROM VideoPurchase WHERE studentId IN (${sPlaceholders})`, args: studentIds });
    deletedCount += pt.rowsAffected + pve.rowsAffected + sub.rowsAffected + qr.rowsAffected + fp.rowsAffected + vp.rowsAffected;
  }

  if (courseIds.length > 0) {
    const cPlaceholders = courseIds.map(() => "?").join(",");
    const ac = await client.execute({ sql: `DELETE FROM AccessCode WHERE courseId IN (${cPlaceholders})`, args: courseIds });
    deletedCount += ac.rowsAffected;
  }

  const hw = await client.execute({ sql: "DELETE FROM Homework WHERE teacherId = ?", args: [teacherId] });
  const ts = await client.execute({ sql: "DELETE FROM TeacherSubscription WHERE teacherId = ?", args: [teacherId] });
  const c = await client.execute({ sql: "DELETE FROM Course WHERE teacherId = ?", args: [teacherId] });
  const tp = await client.execute({ sql: "DELETE FROM TeacherProfile WHERE teacherId = ?", args: [teacherId] });
  const u = await client.execute({ sql: "DELETE FROM User WHERE isDemo = 1", args: [] });

  deletedCount += hw.rowsAffected + ts.rowsAffected + c.rowsAffected + tp.rowsAffected + u.rowsAffected;

  console.log(`✅ Teardown Complete! Total records purged: ${deletedCount}`);
}

main().catch((err) => {
  console.error("❌ Teardown failed:", err);
  process.exit(1);
});
