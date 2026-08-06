import crypto from "crypto";

// Generic type to accept a Prisma transaction object without importing the full Client
type PrismaTransactionClient = {
  $executeRawUnsafe: (query: string, ...values: any[]) => Promise<any>;
};

/**
 * Acquires a transaction-scoped advisory lock in PostgreSQL.
 * If running in SQLite (development), this safely acts as a no-op since
 * SQLite already serializes writes natively.
 * 
 * The lock is automatically released when the transaction commits or rolls back.
 * 
 * @param lockName A unique string key for the lock
 * @param tx The active Prisma transaction client
 */
export async function acquireAdvisoryLock(
  lockName: string,
  tx: PrismaTransactionClient
): Promise<void> {
  const isPg = (process.env.DATABASE_URL ?? "").startsWith("postgres");
  if (!isPg) {
    // SQLite doesn't need or support this
    return;
  }

  // Generate a 32-bit integer hash for the lockName to use with pg_advisory_xact_lock
  const hash = crypto.createHash("md5").update(lockName).digest();
  const lockId = hash.readInt32LE(0); 

  try {
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${lockId})`);
  } catch (error) {
    console.error(`Failed to acquire advisory lock for '${lockName}':`, error);
    throw error;
  }
}
