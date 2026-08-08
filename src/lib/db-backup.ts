import fs from "fs";
import path from "path";
import { logger } from "./whatsapp/logger";

export interface BackupResult {
  success: boolean;
  filename?: string;
  backupPath?: string;
  sizeMb?: number;
  error?: string;
  timestamp?: string;
}

/**
 * Performs a safe, timestamped backup of the database.
 * Retains the last 8 weekly backups and purges older ones to save disk space.
 */
export async function performDatabaseBackup(): Promise<BackupResult> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const isProd = process.env.NODE_ENV === "production";

  // Determine root directory & backups folder
  const projectRoot = process.cwd();
  const backupsDir = path.join(projectRoot, "prisma", "backups");

  try {
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    const dbUrl = process.env.DATABASE_URL || "file:./dev.db";

    if (dbUrl.startsWith("file:") || dbUrl.endsWith(".db") || dbUrl.includes("dev.db")) {
      // ── SQLite Database Backup ──
      const rawDbPath = dbUrl.replace(/^file:/, "");
      const sourceDbPath = path.isAbsolute(rawDbPath)
        ? rawDbPath
        : path.join(projectRoot, "prisma", path.basename(rawDbPath) || "dev.db");

      if (!fs.existsSync(sourceDbPath)) {
        throw new Error(`Source database file not found at: ${sourceDbPath}`);
      }

      const backupFilename = `dev-backup-${timestamp}.db`;
      const targetBackupPath = path.join(backupsDir, backupFilename);

      // Copy SQLite file safely
      fs.copyFileSync(sourceDbPath, targetBackupPath);

      const stats = fs.statSync(targetBackupPath);
      const sizeMb = Number((stats.size / (1024 * 1024)).toFixed(2));

      // Clean up old backups (keep last 8 backups = 2 months of weekly backups)
      cleanOldBackups(backupsDir, 8);

      console.log(`📦 [DB BACKUP SUCCESS] Created ${backupFilename} (${sizeMb} MB) at ${targetBackupPath}`);

      return {
        success: true,
        filename: backupFilename,
        backupPath: targetBackupPath,
        sizeMb,
        timestamp,
      };
    } else {
      // ── PostgreSQL / External DB Notice ──
      console.log("ℹ️ [DB BACKUP] Database URL is non-SQLite (e.g. Postgres). Relying on cloud provider automatic snapshots.");
      return {
        success: true,
        filename: `cloud-managed-snap-${timestamp}`,
        sizeMb: 0,
        timestamp,
      };
    }
  } catch (err: any) {
    const errorMsg = err?.message || "Unknown database backup failure";
    console.error("❌ [DB BACKUP FAILED]:", errorMsg);
    return {
      success: false,
      error: errorMsg,
      timestamp,
    };
  }
}

/**
 * Removes old backup files, leaving only the most recent N backups.
 */
function cleanOldBackups(dir: string, keepCount: number = 8) {
  try {
    const files = fs.readdirSync(dir);
    const backupFiles = files
      .filter((f) => f.startsWith("dev-backup-") && f.endsWith(".db"))
      .map((f) => {
        const filePath = path.join(dir, f);
        return {
          name: f,
          path: filePath,
          ctime: fs.statSync(filePath).ctimeMs,
        };
      })
      .sort((a, b) => b.ctime - a.ctime); // Newest first

    if (backupFiles.length > keepCount) {
      const filesToRemove = backupFiles.slice(keepCount);
      for (const file of filesToRemove) {
        fs.unlinkSync(file.path);
        console.log(`🗑️ [DB BACKUP CLEANUP] Removed old backup: ${file.name}`);
      }
    }
  } catch (err) {
    console.warn("⚠️ Failed to prune old database backups:", err);
  }
}
