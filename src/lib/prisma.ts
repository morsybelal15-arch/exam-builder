import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
  dbReachableCache?: { value: boolean; expiresAt: number } | null;
};

export const isDatabaseConfigured = Boolean(process.env.DATABASE_URL);

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://127.0.0.1:5432/exam_builder_db?schema=public";

const pool =
  globalForPrisma.pool ??
  new Pool({
    connectionString,
    connectionTimeoutMillis: 1500,
    max: 15,
    idleTimeoutMillis: 30_000,
  });

globalForPrisma.pool = pool;

const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: [],
  });

globalForPrisma.prisma = prisma;

/**
 * Checks if the PostgreSQL server is reachable without throwing console errors.
 * Caches the result for 60 seconds on globalThis so unreachable DBs never stall requests.
 */
export async function isDatabaseReachable(): Promise<boolean> {
  if (!process.env.DATABASE_URL) return false;
  const now = Date.now();
  if (globalForPrisma.dbReachableCache && now < globalForPrisma.dbReachableCache.expiresAt) {
    return globalForPrisma.dbReachableCache.value;
  }
  try {
    const client = await pool.connect();
    client.release();
    globalForPrisma.dbReachableCache = { value: true, expiresAt: now + 60_000 };
    return true;
  } catch {
    globalForPrisma.dbReachableCache = { value: false, expiresAt: now + 60_000 };
    return false;
  }
}

export default prisma;
