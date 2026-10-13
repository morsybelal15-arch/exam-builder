import fs from "fs";
import path from "path";
import { prisma, isDatabaseReachable } from "@/lib/prisma";

export interface StoredTenant {
  id: string;
  name: string | null;
  phone: string;
  password?: string;
  role: "TENANT" | "SUPER_ADMIN";
  subscriptionStatus: "ACTIVE" | "STOPPED" | "EXPIRED";
  planType: string;
  domain: string | null;
  subscriptionDueDate: string | null;
  storageLimitBytes: number | string;
  usedStorageBytes: number | string;
  examsLimit: number;
  filesLimit: number;
  verificationCode: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    exams: number;
    uploadedFiles: number;
  };
}

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_FILE = path.join(DATA_DIR, "tenants.json");

function ensureStoreFile(): StoredTenant[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(STORE_FILE)) {
      fs.writeFileSync(STORE_FILE, JSON.stringify([], null, 2), "utf-8");
      return [];
    }
    const raw = fs.readFileSync(STORE_FILE, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("Error accessing local tenants store:", err);
    return [];
  }
}

function saveStoreFile(tenants: StoredTenant[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    // Atomic replace: the tenant app reads this file on every request while the admin app writes it.
    const tmp = `${STORE_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(tenants, null, 2), "utf-8");
    fs.renameSync(tmp, STORE_FILE);
  } catch (err) {
    console.error("Error saving local tenants store:", err);
  }
}

/**
 * High-reliability repository that seamlessly queries PostgreSQL via Prisma
 * when connected, or falls back to persistent local storage when running in local dev.
 */
export async function getTenantsList(): Promise<StoredTenant[]> {
  try {
    const isReachable = await isDatabaseReachable();
    if (isReachable) {
      const dbTenants = await prisma.tenant.findMany({
        where: { role: "TENANT" },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          phone: true,
          role: true,
          domain: true,
          planType: true,
          subscriptionStatus: true,
          subscriptionDueDate: true,
          storageLimitBytes: true,
          usedStorageBytes: true,
          examsLimit: true,
          filesLimit: true,
          verificationCode: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              exams: true,
              uploadedFiles: true,
            },
          },
        },
      });

      return dbTenants.map((t) => ({
        ...t,
        storageLimitBytes: Number(t.storageLimitBytes),
        usedStorageBytes: Number(t.usedStorageBytes),
        subscriptionDueDate: t.subscriptionDueDate ? t.subscriptionDueDate.toISOString() : null,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      }));
    }
  } catch (err) {
    console.warn("Database unreachable for listing, using local fallback store:", err);
  }

  // Fallback to local persistent store
  const localList = ensureStoreFile();
  return localList.filter((t) => t.role === "TENANT");
}

export async function getTenantCounts(): Promise<{
  total: number;
  active: number;
  stopped: number;
  usedStorageBytes: number;
}> {
  try {
    const isReachable = await isDatabaseReachable();
    if (isReachable) {
      const [total, active, stopped, storage] = await Promise.all([
        prisma.tenant.count({ where: { role: "TENANT" } }),
        prisma.tenant.count({ where: { role: "TENANT", subscriptionStatus: "ACTIVE" } }),
        prisma.tenant.count({ where: { role: "TENANT", subscriptionStatus: "STOPPED" } }),
        prisma.tenant.aggregate({ _sum: { usedStorageBytes: true } }),
      ]);
      return {
        total,
        active,
        stopped,
        usedStorageBytes: Number(storage._sum.usedStorageBytes ?? 0),
      };
    }
  } catch (err) {
    console.warn("Database unreachable for counts, using local store:", err);
  }

  const localList = ensureStoreFile().filter((t) => t.role === "TENANT");
  const total = localList.length;
  const active = localList.filter((t) => t.subscriptionStatus === "ACTIVE").length;
  const stopped = localList.filter((t) => t.subscriptionStatus === "STOPPED").length;
  const usedStorageBytes = localList.reduce((acc, t) => acc + Number(t.usedStorageBytes || 0), 0);

  return { total, active, stopped, usedStorageBytes };
}

export async function findTenantByPhone(phone: string): Promise<StoredTenant | null> {
  const cleanPhone = phone.trim();
  try {
    const isReachable = await isDatabaseReachable();
    if (isReachable) {
      const dbTenant = await prisma.tenant.findUnique({
        where: { phone: cleanPhone },
      });
      if (dbTenant) {
        return {
          ...dbTenant,
          storageLimitBytes: Number(dbTenant.storageLimitBytes),
          usedStorageBytes: Number(dbTenant.usedStorageBytes),
          subscriptionDueDate: dbTenant.subscriptionDueDate ? dbTenant.subscriptionDueDate.toISOString() : null,
          createdAt: dbTenant.createdAt.toISOString(),
          updatedAt: dbTenant.updatedAt.toISOString(),
        };
      }
    }
  } catch (err) {
    console.warn("Database unreachable for findTenantByPhone, using local store:", err);
  }

  const localList = ensureStoreFile();
  const match = localList.find((t) => t.phone === cleanPhone);
  return match || null;
}

export async function findTenantById(id: string): Promise<StoredTenant | null> {
  try {
    const isReachable = await isDatabaseReachable();
    if (isReachable) {
      const dbTenant = await prisma.tenant.findUnique({ where: { id } });
      if (dbTenant) {
        return {
          ...dbTenant,
          storageLimitBytes: Number(dbTenant.storageLimitBytes),
          usedStorageBytes: Number(dbTenant.usedStorageBytes),
          subscriptionDueDate: dbTenant.subscriptionDueDate ? dbTenant.subscriptionDueDate.toISOString() : null,
          createdAt: dbTenant.createdAt.toISOString(),
          updatedAt: dbTenant.updatedAt.toISOString(),
        };
      }
    }
  } catch {
    // fall through to local store
  }
  return ensureStoreFile().find((t) => t.id === id) || null;
}

/**
 * Single source of truth for whether a tenant may use the app.
 * Returns an Arabic reason string when access is blocked, or null when allowed.
 */
export function getTenantAccessBlock(
  tenant: Pick<StoredTenant, "role" | "subscriptionStatus" | "subscriptionDueDate"> | null
): string | null {
  if (!tenant) return "الحساب غير موجود. يرجى التواصل مع الإدارة.";
  if (tenant.role === "SUPER_ADMIN") return null;
  if (tenant.subscriptionStatus === "STOPPED") {
    return "حسابك متوقف حالياً. يرجى التواصل مع الإدارة لتجديد الاشتراك.";
  }
  if (tenant.subscriptionStatus === "EXPIRED") {
    return "انتهى اشتراكك. يرجى التواصل مع الإدارة للتجديد.";
  }
  if (tenant.subscriptionDueDate && new Date(tenant.subscriptionDueDate).getTime() < Date.now()) {
    return "انتهت مدة اشتراكك. يرجى التواصل مع الإدارة للتجديد.";
  }
  return null;
}

/**
 * Returns the raw tenant store (including password hashes) for syncing to the VPS.
 */
export function exportRawTenantStore(): StoredTenant[] {
  return ensureStoreFile();
}

export async function createTenantRecord(data: {
  name: string;
  phone: string;
  password: string; // Already hashed
  domain: string | null;
  role?: "TENANT" | "SUPER_ADMIN";
  subscriptionStatus?: "ACTIVE" | "STOPPED" | "EXPIRED";
  planType: string;
  subscriptionDueDate: Date;
  storageLimitBytes: bigint | number;
  examsLimit: number;
  filesLimit: number;
  verificationCode: string;
  notes?: string | null;
}): Promise<StoredTenant> {
  const id = `tenant_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date();

  // Try PostgreSQL Prisma first
  try {
    const isReachable = await isDatabaseReachable();
    if (isReachable) {
      const created = await prisma.tenant.create({
        data: {
          name: data.name,
          phone: data.phone,
          password: data.password,
          domain: data.domain,
          role: data.role || "TENANT",
          subscriptionStatus: data.subscriptionStatus || "ACTIVE",
          planType: data.planType,
          subscriptionDueDate: data.subscriptionDueDate,
          storageLimitBytes: BigInt(data.storageLimitBytes),
          examsLimit: data.examsLimit,
          filesLimit: data.filesLimit,
          verificationCode: data.verificationCode,
          notes: data.notes || null,
        },
      });

      return {
        ...created,
        storageLimitBytes: Number(created.storageLimitBytes),
        usedStorageBytes: Number(created.usedStorageBytes),
        subscriptionDueDate: created.subscriptionDueDate ? created.subscriptionDueDate.toISOString() : null,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
        _count: { exams: 0, uploadedFiles: 0 },
      };
    }
  } catch (err) {
    console.warn("Database unreachable during create, saving to persistent local store:", err);
  }

  // Fallback to local store
  const localList = ensureStoreFile();
  const newTenant: StoredTenant = {
    id,
    name: data.name,
    phone: data.phone,
    password: data.password,
    domain: data.domain,
    role: data.role || "TENANT",
    subscriptionStatus: data.subscriptionStatus || "ACTIVE",
    planType: data.planType,
    subscriptionDueDate: data.subscriptionDueDate.toISOString(),
    storageLimitBytes: Number(data.storageLimitBytes),
    usedStorageBytes: 0,
    examsLimit: data.examsLimit,
    filesLimit: data.filesLimit,
    verificationCode: data.verificationCode,
    notes: data.notes || null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    _count: { exams: 0, uploadedFiles: 0 },
  };

  localList.unshift(newTenant);
  saveStoreFile(localList);
  return newTenant;
}

export async function updateTenantRecord(
  id: string,
  data: Partial<{
    name: string;
    phone: string;
    domain: string | null;
    planType: string;
    subscriptionStatus: "ACTIVE" | "STOPPED" | "EXPIRED";
    subscriptionDueDate: Date;
    storageLimitBytes: bigint | number;
    examsLimit: number;
    filesLimit: number;
    verificationCode: string;
    password?: string;
    notes?: string | null;
  }>
): Promise<StoredTenant | null> {
  try {
    const isReachable = await isDatabaseReachable();
    if (isReachable) {
      const payload: any = { ...data };
      if (data.storageLimitBytes !== undefined) {
        payload.storageLimitBytes = BigInt(data.storageLimitBytes);
      }
      const updated = await prisma.tenant.update({
        where: { id },
        data: payload,
      });
      return {
        ...updated,
        storageLimitBytes: Number(updated.storageLimitBytes),
        usedStorageBytes: Number(updated.usedStorageBytes),
        subscriptionDueDate: updated.subscriptionDueDate ? updated.subscriptionDueDate.toISOString() : null,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      };
    }
  } catch (err) {
    console.warn("Database unreachable during update, modifying local store:", err);
  }

  // Update in local store
  const localList = ensureStoreFile();
  const idx = localList.findIndex((t) => t.id === id);
  if (idx === -1) return null;

  const current = localList[idx];
  const updated: StoredTenant = {
    ...current,
    name: data.name !== undefined ? data.name : current.name,
    phone: data.phone !== undefined ? data.phone : current.phone,
    domain: data.domain !== undefined ? data.domain : current.domain,
    planType: data.planType !== undefined ? data.planType : current.planType,
    subscriptionStatus: data.subscriptionStatus !== undefined ? data.subscriptionStatus : current.subscriptionStatus,
    subscriptionDueDate: data.subscriptionDueDate !== undefined ? data.subscriptionDueDate.toISOString() : current.subscriptionDueDate,
    storageLimitBytes: data.storageLimitBytes !== undefined ? Number(data.storageLimitBytes) : current.storageLimitBytes,
    examsLimit: data.examsLimit !== undefined ? data.examsLimit : current.examsLimit,
    filesLimit: data.filesLimit !== undefined ? data.filesLimit : current.filesLimit,
    verificationCode: data.verificationCode !== undefined ? data.verificationCode : current.verificationCode,
    notes: data.notes !== undefined ? data.notes : current.notes,
    password: data.password !== undefined ? data.password : current.password,
    updatedAt: new Date().toISOString(),
  };

  localList[idx] = updated;
  saveStoreFile(localList);
  return updated;
}

export async function deleteTenantRecord(id: string): Promise<boolean> {
  try {
    const isReachable = await isDatabaseReachable();
    if (isReachable) {
      await prisma.tenant.delete({ where: { id } });
      return true;
    }
  } catch (err) {
    console.warn("Database unreachable during delete, removing from local store:", err);
  }

  const localList = ensureStoreFile();
  const filtered = localList.filter((t) => t.id !== id);
  saveStoreFile(filtered);
  return true;
}
