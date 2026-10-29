import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
};

export const isDatabaseConfigured = Boolean(process.env.DATABASE_URL);

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://exam_builder:ExamBuilder2026!@127.0.0.1:5432/exam_builder_db?schema=public";

const pool =
  globalForPrisma.pool ??
  new Pool({
    connectionString,
    connectionTimeoutMillis: 1500,
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.pool = pool;

const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    // Prevent Prisma from logging raw error events to console in dev mode,
    // which triggers Next.js Turbopack's Console Error modal overlay
    log: [],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

let dbReachableCache: { value: boolean; expiresAt: number } | null = null;

/**
 * Checks if the PostgreSQL server is reachable without throwing console errors.
 * Caches the result for 60 seconds so unreachable DBs never stall requests.
 */
export async function isDatabaseReachable(): Promise<boolean> {
  if (!process.env.DATABASE_URL) return false;
  const now = Date.now();
  if (dbReachableCache && now < dbReachableCache.expiresAt) {
    return dbReachableCache.value;
  }
  try {
    const client = await pool.connect();
    client.release();
    dbReachableCache = { value: true, expiresAt: now + 60_000 };
    return true;
  } catch {
    dbReachableCache = { value: false, expiresAt: now + 60_000 };
    return false;
  }
}

export default prisma;
