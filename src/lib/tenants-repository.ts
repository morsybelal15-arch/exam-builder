import fs from "fs";
import path from "path";
import { prisma, isDatabaseReachable } from "@/lib/prisma";
import { getTenantUsageStats, getUploadsDir, purgeTenantLocalDb } from "@/lib/db";
import { getManagementStore, purgeTenantManagementStore } from "@/lib/management-db";
import {
  ALL_FEATURE_IDS,
  SubscriptionCategory,
  normalizeEnabledFeatures,
} from "@/lib/app-features";

export interface StoredTenant {
  id: string;
  name: string | null;
  phone: string;
  password?: string;
  role: "TENANT" | "SUPER_ADMIN";
  subscriptionStatus: "ACTIVE" | "STOPPED" | "EXPIRED";
  planType: string;
  subscriptionType?: SubscriptionCategory;
  domain: string | null;
  subscriptionStartDate?: string | null;
  subscriptionDueDate: string | null;
  enabledFeatures?: string[];
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

interface TenantMetaEnvelope {
  __meta: 1;
  subscriptionType: SubscriptionCategory;
  subscriptionStartDate: string | null;
  enabledFeatures: string[];
}

function inferSubscriptionType(planType?: string | null): SubscriptionCategory {
  if (!planType) return "سنتر";
  if (planType.includes("معلم") && !planType.includes("سنتر")) return "معلم";
  return "سنتر";
}

function encodeTenantMeta(meta: {
  subscriptionType?: SubscriptionCategory;
  subscriptionStartDate?: string | null;
  enabledFeatures?: string[];
}): string {
  const payload: TenantMetaEnvelope = {
    __meta: 1,
    subscriptionType: meta.subscriptionType || "سنتر",
    subscriptionStartDate: meta.subscriptionStartDate || null,
    enabledFeatures: normalizeEnabledFeatures(meta.enabledFeatures),
  };
  return JSON.stringify(payload);
}

function decodeTenantMeta(
  rawVerificationField?: string | null,
  localFallback?: Partial<StoredTenant> | null,
  planType?: string | null,
  createdAtIso?: string
): {
  subscriptionType: SubscriptionCategory;
  subscriptionStartDate: string | null;
  enabledFeatures: string[];
} {
  if (rawVerificationField && rawVerificationField.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(rawVerificationField) as Partial<TenantMetaEnvelope>;
      if (parsed && parsed.__meta === 1) {
        return {
          subscriptionType:
            parsed.subscriptionType === "معلم" || parsed.subscriptionType === "سنتر"
              ? parsed.subscriptionType
              : inferSubscriptionType(planType),
          subscriptionStartDate:
            parsed.subscriptionStartDate ||
            localFallback?.subscriptionStartDate ||
            createdAtIso ||
            null,
          enabledFeatures: normalizeEnabledFeatures(
            parsed.enabledFeatures || localFallback?.enabledFeatures
          ),
        };
      }
    } catch {
      // fall through
    }
  }

  return {
    subscriptionType:
      localFallback?.subscriptionType === "معلم" || localFallback?.subscriptionType === "سنتر"
        ? localFallback.subscriptionType
        : inferSubscriptionType(planType),
    subscriptionStartDate:
      localFallback?.subscriptionStartDate || createdAtIso || new Date().toISOString(),
    enabledFeatures: normalizeEnabledFeatures(localFallback?.enabledFeatures),
  };
}

/**
 * Ensures the isolated SQLite & JSON database stores are created for a tenant ID.
 */
export function provisionTenantLocalDatabase(tenantId: string): void {
  try {
    getUploadsDir(tenantId);
    getManagementStore(tenantId);
  } catch (err) {
    console.warn(`Warning initializing isolated DB for ${tenantId}:`, err);
  }
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
    const parsed: StoredTenant[] = JSON.parse(raw);
    return parsed.map((t) => {
      const meta = decodeTenantMeta(t.verificationCode, t, t.planType, t.createdAt);
      return {
        ...t,
        subscriptionType: meta.subscriptionType,
        subscriptionStartDate: meta.subscriptionStartDate,
        enabledFeatures: meta.enabledFeatures,
      };
    });
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
  const localList = ensureStoreFile();
  const localById = new Map(localList.map((t) => [t.id, t]));

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

      return dbTenants.map((t) => {
        const localUsage = getTenantUsageStats(t.id);
        const prismaUsed = Number(t.usedStorageBytes);
        const createdIso = t.createdAt.toISOString();
        const meta = decodeTenantMeta(
          t.verificationCode,
          localById.get(t.id),
          t.planType,
          createdIso
        );
        return {
          ...t,
          subscriptionType: meta.subscriptionType,
          subscriptionStartDate: meta.subscriptionStartDate,
          enabledFeatures: meta.enabledFeatures,
          storageLimitBytes: Number(t.storageLimitBytes),
          usedStorageBytes: Math.max(prismaUsed, localUsage.usedStorageBytes),
          subscriptionDueDate: t.subscriptionDueDate ? t.subscriptionDueDate.toISOString() : null,
          createdAt: createdIso,
          updatedAt: t.updatedAt.toISOString(),
          _count: {
            exams: Math.max(t._count?.exams || 0, localUsage.examsCount),
            uploadedFiles: Math.max(t._count?.uploadedFiles || 0, localUsage.filesCount),
          },
        };
      });
    }
  } catch (err) {
    console.warn("Database unreachable for listing, using local fallback store:", err);
  }

  // Fallback to local persistent store
  return localList
    .filter((t) => t.role === "TENANT")
    .map((t) => {
      const localUsage = getTenantUsageStats(t.id);
      return {
        ...t,
        usedStorageBytes: Math.max(Number(t.usedStorageBytes || 0), localUsage.usedStorageBytes),
        _count: {
          exams: Math.max(t._count?.exams || 0, localUsage.examsCount),
          uploadedFiles: Math.max(t._count?.uploadedFiles || 0, localUsage.filesCount),
        },
      };
    });
}

export async function getTenantCounts(): Promise<{
  total: number;
  active: number;
  stopped: number;
  usedStorageBytes: number;
}> {
  try {
    const tenants = await getTenantsList();
    const total = tenants.length;
    const active = tenants.filter((t) => t.subscriptionStatus === "ACTIVE").length;
    const stopped = tenants.filter((t) => t.subscriptionStatus === "STOPPED").length;
    const usedStorageBytes = tenants.reduce((acc, t) => acc + Number(t.usedStorageBytes || 0), 0);
    return { total, active, stopped, usedStorageBytes };
  } catch (err) {
    console.warn("Error computing tenant counts:", err);
    return { total: 0, active: 0, stopped: 0, usedStorageBytes: 0 };
  }
}

export async function findTenantByPhone(phone: string): Promise<StoredTenant | null> {
  const cleanPhone = phone.trim();
  const localList = ensureStoreFile();
  const localMatch = localList.find((t) => t.phone === cleanPhone) || null;

  try {
    const isReachable = await isDatabaseReachable();
    if (isReachable) {
      const dbTenant = await prisma.tenant.findUnique({
        where: { phone: cleanPhone },
      });
      if (dbTenant) {
        const createdIso = dbTenant.createdAt.toISOString();
        const meta = decodeTenantMeta(
          dbTenant.verificationCode,
          localMatch,
          dbTenant.planType,
          createdIso
        );
        return {
          ...dbTenant,
          subscriptionType: meta.subscriptionType,
          subscriptionStartDate: meta.subscriptionStartDate,
          enabledFeatures: meta.enabledFeatures,
          storageLimitBytes: Number(dbTenant.storageLimitBytes),
          usedStorageBytes: Number(dbTenant.usedStorageBytes),
          subscriptionDueDate: dbTenant.subscriptionDueDate
            ? dbTenant.subscriptionDueDate.toISOString()
            : null,
          createdAt: createdIso,
          updatedAt: dbTenant.updatedAt.toISOString(),
        };
      }
    }
  } catch (err) {
    console.warn("Database unreachable for findTenantByPhone, using local store:", err);
  }

  return localMatch;
}

export async function findTenantById(id: string): Promise<StoredTenant | null> {
  const localList = ensureStoreFile();
  const localMatch = localList.find((t) => t.id === id) || null;

  try {
    const isReachable = await isDatabaseReachable();
    if (isReachable) {
      const dbTenant = await prisma.tenant.findUnique({ where: { id } });
      if (dbTenant) {
        const createdIso = dbTenant.createdAt.toISOString();
        const meta = decodeTenantMeta(
          dbTenant.verificationCode,
          localMatch,
          dbTenant.planType,
          createdIso
        );
        return {
          ...dbTenant,
          subscriptionType: meta.subscriptionType,
          subscriptionStartDate: meta.subscriptionStartDate,
          enabledFeatures: meta.enabledFeatures,
          storageLimitBytes: Number(dbTenant.storageLimitBytes),
          usedStorageBytes: Number(dbTenant.usedStorageBytes),
          subscriptionDueDate: dbTenant.subscriptionDueDate
            ? dbTenant.subscriptionDueDate.toISOString()
            : null,
          createdAt: createdIso,
          updatedAt: dbTenant.updatedAt.toISOString(),
        };
      }
    }
  } catch {
    // fall through to local store
  }
  return localMatch;
}

/**
 * Single source of truth for whether a tenant may use the app.
 * Returns an Arabic reason string when access is blocked, or null when allowed.
 */
export function getTenantAccessBlock(
  tenant: Pick<
    StoredTenant,
    "role" | "subscriptionStatus" | "subscriptionStartDate" | "subscriptionDueDate"
  > | null
): string | null {
  if (!tenant) return "الحساب غير موجود. يرجى التواصل مع الإدارة.";
  if (tenant.role === "SUPER_ADMIN") return null;
  if (tenant.subscriptionStatus === "STOPPED") {
    return "حسابك متوقف حالياً. يرجى التواصل مع الإدارة لتفعيل الاشتراك.";
  }
  if (tenant.subscriptionStatus === "EXPIRED") {
    return "انتهى اشتراكك. يرجى التواصل مع الإدارة للتجديد.";
  }
  if (tenant.subscriptionStartDate) {
    const start = new Date(tenant.subscriptionStartDate);
    start.setHours(0, 0, 0, 0);
    if (start.getTime() > Date.now()) {
      return `لم يبدأ موعد سريان اشتراكك بعد (يبدأ في ${start.toLocaleDateString("ar-EG")}).`;
    }
  }
  if (tenant.subscriptionDueDate) {
    const due = new Date(tenant.subscriptionDueDate);
    due.setHours(23, 59, 59, 999);
    if (due.getTime() < Date.now()) {
      return "انتهت مدة اشتراكك. يرجى التواصل مع الإدارة للتجديد.";
    }
  }
  return null;
}

export async function findTenantByDomain(domain: string): Promise<StoredTenant | null> {
  const cleanDomain = domain.trim().toLowerCase().split(":")[0];
  if (!cleanDomain || cleanDomain === "localhost" || cleanDomain === "127.0.0.1") return null;
  const localList = ensureStoreFile();
  const localMatch = localList.find((t) => (t.domain || "").toLowerCase() === cleanDomain) || null;

  try {
    const isReachable = await isDatabaseReachable();
    if (isReachable) {
      const dbTenant = await prisma.tenant.findFirst({
        where: { domain: cleanDomain },
      });
      if (dbTenant) {
        const createdIso = dbTenant.createdAt.toISOString();
        const meta = decodeTenantMeta(
          dbTenant.verificationCode,
          localMatch,
          dbTenant.planType,
          createdIso
        );
        return {
          ...dbTenant,
          subscriptionType: meta.subscriptionType,
          subscriptionStartDate: meta.subscriptionStartDate,
          enabledFeatures: meta.enabledFeatures,
          storageLimitBytes: Number(dbTenant.storageLimitBytes),
          usedStorageBytes: Number(dbTenant.usedStorageBytes),
          subscriptionDueDate: dbTenant.subscriptionDueDate
            ? dbTenant.subscriptionDueDate.toISOString()
            : null,
          createdAt: createdIso,
          updatedAt: dbTenant.updatedAt.toISOString(),
        };
      }
    }
  } catch {
    // fall through to local store
  }
  return localMatch;
}

/**
 * Returns the raw tenant store (including password hashes) for syncing to the VPS.
 * Mirrors PostgreSQL records to data/tenants.json when PostgreSQL is reachable.
 */
export function exportRawTenantStore(): StoredTenant[] {
  return ensureStoreFile();
}

export async function exportRawTenantStoreAsync(): Promise<StoredTenant[]> {
  const localList = ensureStoreFile();
  const localById = new Map(localList.map((t) => [t.id, t]));

  try {
    const isReachable = await isDatabaseReachable();
    if (isReachable) {
      const dbTenants = await prisma.tenant.findMany({
        orderBy: { createdAt: "desc" },
      });
      if (dbTenants.length > 0) {
        const mapped: StoredTenant[] = dbTenants.map((t) => {
          const createdIso = t.createdAt.toISOString();
          const meta = decodeTenantMeta(
            t.verificationCode,
            localById.get(t.id),
            t.planType,
            createdIso
          );
          return {
            id: t.id,
            name: t.name,
            phone: t.phone,
            password: t.password,
            role: t.role,
            subscriptionStatus: t.subscriptionStatus,
            planType: t.planType,
            subscriptionType: meta.subscriptionType,
            domain: t.domain,
            subscriptionStartDate: meta.subscriptionStartDate,
            subscriptionDueDate: t.subscriptionDueDate ? t.subscriptionDueDate.toISOString() : null,
            enabledFeatures: meta.enabledFeatures,
            storageLimitBytes: Number(t.storageLimitBytes),
            usedStorageBytes: Number(t.usedStorageBytes),
            examsLimit: t.examsLimit,
            filesLimit: t.filesLimit,
            verificationCode: encodeTenantMeta(meta),
            notes: t.notes,
            createdAt: createdIso,
            updatedAt: t.updatedAt.toISOString(),
          };
        });
        saveStoreFile(mapped);
        return mapped;
      }
    }
  } catch (err) {
    console.warn("Error exporting tenants from DB, falling back to local file:", err);
  }
  return localList;
}

export async function createTenantRecord(data: {
  name: string;
  phone: string;
  password: string; // Already hashed
  domain: string | null;
  role?: "TENANT" | "SUPER_ADMIN";
  subscriptionStatus?: "ACTIVE" | "STOPPED" | "EXPIRED";
  planType: string;
  subscriptionType?: SubscriptionCategory;
  subscriptionStartDate?: Date;
  subscriptionDueDate: Date;
  enabledFeatures?: string[];
  storageLimitBytes: bigint | number;
  examsLimit: number;
  filesLimit: number;
  notes?: string | null;
}): Promise<StoredTenant> {
  const id = `tenant_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date();
  const startDateObj = data.subscriptionStartDate ? new Date(data.subscriptionStartDate) : now;
  startDateObj.setUTCHours(0, 0, 0, 0);
  const startDateIso = startDateObj.toISOString();
  const dueDate = new Date(data.subscriptionDueDate);
  dueDate.setUTCHours(23, 59, 59, 999);

  const subType: SubscriptionCategory =
    data.subscriptionType || inferSubscriptionType(data.planType);
  const features = normalizeEnabledFeatures(data.enabledFeatures || ALL_FEATURE_IDS);
  const metaEncoded = encodeTenantMeta({
    subscriptionType: subType,
    subscriptionStartDate: startDateIso,
    enabledFeatures: features,
  });

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
          subscriptionDueDate: dueDate,
          storageLimitBytes: BigInt(data.storageLimitBytes),
          examsLimit: data.examsLimit,
          filesLimit: data.filesLimit,
          verificationCode: metaEncoded,
          notes: data.notes || null,
        },
      });

      const storedRecord: StoredTenant = {
        ...created,
        subscriptionType: subType,
        subscriptionStartDate: startDateIso,
        enabledFeatures: features,
        storageLimitBytes: Number(created.storageLimitBytes),
        usedStorageBytes: Number(created.usedStorageBytes),
        subscriptionDueDate: created.subscriptionDueDate
          ? created.subscriptionDueDate.toISOString()
          : null,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
        _count: { exams: 0, uploadedFiles: 0 },
      };

      // Mirror to data/tenants.json so VPS sync and local fallback stay synchronized
      const localList = ensureStoreFile().filter(
        (t) => t.id !== storedRecord.id && t.phone !== storedRecord.phone
      );
      localList.unshift(storedRecord);
      saveStoreFile(localList);

      // Provision isolated tenant DB & management store immediately
      provisionTenantLocalDatabase(storedRecord.id);

      return storedRecord;
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
    subscriptionType: subType,
    subscriptionStartDate: startDateIso,
    subscriptionDueDate: dueDate.toISOString(),
    enabledFeatures: features,
    storageLimitBytes: Number(data.storageLimitBytes),
    usedStorageBytes: 0,
    examsLimit: data.examsLimit,
    filesLimit: data.filesLimit,
    verificationCode: metaEncoded,
    notes: data.notes || null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    _count: { exams: 0, uploadedFiles: 0 },
  };

  localList.unshift(newTenant);
  saveStoreFile(localList);

  // Provision isolated tenant DB & management store immediately
  provisionTenantLocalDatabase(newTenant.id);

  return newTenant;
}

export async function updateTenantRecord(
  id: string,
  data: Partial<{
    name: string;
    phone: string;
    domain: string | null;
    planType: string;
    subscriptionType: SubscriptionCategory;
    subscriptionStatus: "ACTIVE" | "STOPPED" | "EXPIRED";
    subscriptionStartDate: Date;
    subscriptionDueDate: Date;
    enabledFeatures: string[];
    storageLimitBytes: bigint | number;
    examsLimit: number;
    filesLimit: number;
    password?: string;
    notes?: string | null;
  }>
): Promise<StoredTenant | null> {
  const localList = ensureStoreFile();
  const existingLocal = localList.find((t) => t.id === id) || null;
  const existing = existingLocal || (await findTenantById(id));

  const mergedSubscriptionType: SubscriptionCategory =
    data.subscriptionType ||
    existing?.subscriptionType ||
    inferSubscriptionType(data.planType || existing?.planType);

  let mergedStartDateIso: string | null =
    existing?.subscriptionStartDate || existing?.createdAt || new Date().toISOString();
  if (data.subscriptionStartDate !== undefined) {
    const startObj = new Date(data.subscriptionStartDate);
    startObj.setUTCHours(0, 0, 0, 0);
    mergedStartDateIso = startObj.toISOString();
  }

  const mergedFeatures: string[] = normalizeEnabledFeatures(
    data.enabledFeatures !== undefined ? data.enabledFeatures : existing?.enabledFeatures
  );

  let normalizedDueDate: Date | undefined = undefined;
  if (data.subscriptionDueDate !== undefined) {
    normalizedDueDate = new Date(data.subscriptionDueDate);
    normalizedDueDate.setUTCHours(23, 59, 59, 999);
  }

  const metaEncoded = encodeTenantMeta({
    subscriptionType: mergedSubscriptionType,
    subscriptionStartDate: mergedStartDateIso,
    enabledFeatures: mergedFeatures,
  });

  try {
    const isReachable = await isDatabaseReachable();
    if (isReachable) {
      const payload: any = {
        verificationCode: metaEncoded,
      };
      if (data.name !== undefined) payload.name = data.name;
      if (data.phone !== undefined) payload.phone = data.phone;
      if (data.domain !== undefined) payload.domain = data.domain;
      if (data.planType !== undefined) payload.planType = data.planType;
      if (data.subscriptionStatus !== undefined) payload.subscriptionStatus = data.subscriptionStatus;
      if (normalizedDueDate !== undefined) payload.subscriptionDueDate = normalizedDueDate;
      if (data.storageLimitBytes !== undefined) {
        payload.storageLimitBytes = BigInt(data.storageLimitBytes);
      }
      if (data.examsLimit !== undefined) payload.examsLimit = data.examsLimit;
      if (data.filesLimit !== undefined) payload.filesLimit = data.filesLimit;
      if (data.notes !== undefined) payload.notes = data.notes;
      if (data.password !== undefined) payload.password = data.password;

      const updated = await prisma.tenant.update({
        where: { id },
        data: payload,
      });
      const storedUpdated: StoredTenant = {
        ...updated,
        subscriptionType: mergedSubscriptionType,
        subscriptionStartDate: mergedStartDateIso,
        enabledFeatures: mergedFeatures,
        storageLimitBytes: Number(updated.storageLimitBytes),
        usedStorageBytes: Number(updated.usedStorageBytes),
        subscriptionDueDate: updated.subscriptionDueDate
          ? updated.subscriptionDueDate.toISOString()
          : null,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      };

      // Mirror update to data/tenants.json
      const idx = localList.findIndex((t) => t.id === id);
      if (idx !== -1) {
        localList[idx] = { ...localList[idx], ...storedUpdated };
      } else {
        localList.unshift(storedUpdated);
      }
      saveStoreFile(localList);

      return storedUpdated;
    }
  } catch (err) {
    console.warn("Database unreachable during update, modifying local store:", err);
  }

  // Update in local store
  const idx = localList.findIndex((t) => t.id === id);
  if (idx === -1) return null;

  const current = localList[idx];
  const updated: StoredTenant = {
    ...current,
    name: data.name !== undefined ? data.name : current.name,
    phone: data.phone !== undefined ? data.phone : current.phone,
    domain: data.domain !== undefined ? data.domain : current.domain,
    planType: data.planType !== undefined ? data.planType : current.planType,
    subscriptionType: mergedSubscriptionType,
    subscriptionStatus:
      data.subscriptionStatus !== undefined ? data.subscriptionStatus : current.subscriptionStatus,
    subscriptionStartDate: mergedStartDateIso,
    subscriptionDueDate:
      normalizedDueDate !== undefined
        ? normalizedDueDate.toISOString()
        : current.subscriptionDueDate,
    enabledFeatures: mergedFeatures,
    storageLimitBytes:
      data.storageLimitBytes !== undefined
        ? Number(data.storageLimitBytes)
        : current.storageLimitBytes,
    examsLimit: data.examsLimit !== undefined ? data.examsLimit : current.examsLimit,
    filesLimit: data.filesLimit !== undefined ? data.filesLimit : current.filesLimit,
    verificationCode: metaEncoded,
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
    }
  } catch (err) {
    console.warn("Database unreachable during delete, removing from local store:", err);
  }

  const localList = ensureStoreFile();
  const filtered = localList.filter((t) => t.id !== id);
  saveStoreFile(filtered);

  purgeTenantLocalDb(id);
  purgeTenantManagementStore(id);

  return true;
}
