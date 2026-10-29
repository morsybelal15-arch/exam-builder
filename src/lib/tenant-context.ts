import { AsyncLocalStorage } from "node:async_hooks";

interface TenantContextBox {
  tenantId: string | null;
}

const globalForTenant = globalThis as unknown as {
  __examBuilderTenantAls?: AsyncLocalStorage<TenantContextBox>;
  __examBuilderLastTenantId?: string | null;
};

const tenantStorage =
  globalForTenant.__examBuilderTenantAls ||
  (globalForTenant.__examBuilderTenantAls = new AsyncLocalStorage<TenantContextBox>());

/**
 * Initializes a mutable context box in the caller's synchronous execution frame
 * BEFORE the first `await` so that mutations inside awaited child functions
 * (like `getSessionUser` / `requireApiSession`) persist back to the route handler.
 */
export function initTenantContextBox(): TenantContextBox {
  let box = tenantStorage.getStore();
  if (!box) {
    box = { tenantId: null };
    tenantStorage.enterWith(box);
  }
  return box;
}

/**
 * Sets the active tenant ID for the remainder of the current async execution context.
 */
export function setCurrentTenantId(tenantId: string): void {
  if (!tenantId) return;
  globalForTenant.__examBuilderLastTenantId = tenantId;
  const box = tenantStorage.getStore();
  if (box) {
    box.tenantId = tenantId;
  } else {
    tenantStorage.enterWith({ tenantId });
  }
}

/**
 * Retrieves the active tenant ID for the current request context, or null if not set.
 */
export function getCurrentTenantId(): string | null {
  const box = tenantStorage.getStore();
  if (box?.tenantId) {
    return box.tenantId;
  }
  return globalForTenant.__examBuilderLastTenantId ?? null;
}

/**
 * Runs a callback within an explicit tenant ID context.
 */
export function runWithTenantId<T>(tenantId: string, fn: () => T): T {
  globalForTenant.__examBuilderLastTenantId = tenantId;
  return tenantStorage.run({ tenantId }, fn);
}

/**
 * Sanitizes a tenant ID so it is safe to use as a directory/file segment.
 */
export function sanitizeTenantKey(tenantId?: string | null): string {
  const raw = (tenantId || getCurrentTenantId() || "default").trim();
  const clean = raw.replace(/[^a-zA-Z0-9_-]/g, "_");
  return clean || "default";
}
