const fs = require("fs");
const path = require("path");

function performBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const projectRoot = process.cwd();
  const backupsDir = path.join(projectRoot, "prisma", "backups");

  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  const dbUrl = process.env.DATABASE_URL || "file:./dev.db";

  if (dbUrl.startsWith("file:") || dbUrl.endsWith(".db") || dbUrl.includes("dev.db")) {
    const rawDbPath = dbUrl.replace(/^file:/, "");
    const sourceDbPath = path.isAbsolute(rawDbPath)
      ? rawDbPath
      : path.join(projectRoot, "prisma", path.basename(rawDbPath) || "dev.db");

    if (!fs.existsSync(sourceDbPath)) {
      console.error(`❌ Source database file not found: ${sourceDbPath}`);
      process.exit(1);
    }

    const backupFilename = `dev-backup-${timestamp}.db`;
    const targetBackupPath = path.join(backupsDir, backupFilename);

    fs.copyFileSync(sourceDbPath, targetBackupPath);

    const stats = fs.statSync(targetBackupPath);
    const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);

    // Keep last 8 backups
    const files = fs.readdirSync(backupsDir);
    const backupFiles = files
      .filter((f) => f.startsWith("dev-backup-") && f.endsWith(".db"))
      .map((f) => {
        const filePath = path.join(backupsDir, f);
        return { name: f, path: filePath, ctime: fs.statSync(filePath).ctimeMs };
      })
      .sort((a, b) => b.ctime - a.ctime);

    if (backupFiles.length > 8) {
      for (const file of backupFiles.slice(8)) {
        fs.unlinkSync(file.path);
        console.log(`🗑️ Removed old backup: ${file.name}`);
      }
    }

    console.log(`✅ [DB BACKUP SUCCESS] Saved to prisma/backups/${backupFilename} (${sizeMb} MB)`);
  } else {
    console.log("ℹ️ Database is external (Postgres). Relying on cloud snapshots.");
  }
}

performBackup();
