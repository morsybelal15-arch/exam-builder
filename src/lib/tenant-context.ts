import { AsyncLocalStorage } from "node:async_hooks";

const tenantStorage = new AsyncLocalStorage<string>();

/**
 * Sets the active tenant ID for the remainder of the current async execution context.
 */
export function setCurrentTenantId(tenantId: string): void {
  if (tenantId) {
    tenantStorage.enterWith(tenantId);
  }
}

/**
 * Retrieves the active tenant ID for the current request context, or null if not set.
 */
export function getCurrentTenantId(): string | null {
  return tenantStorage.getStore() ?? null;
}

/**
 * Runs a callback within an explicit tenant ID context.
 */
export function runWithTenantId<T>(tenantId: string, fn: () => T): T {
  return tenantStorage.run(tenantId, fn);
}

/**
 * Sanitizes a tenant ID so it is safe to use as a directory/file segment.
 */
export function sanitizeTenantKey(tenantId?: string | null): string {
  const raw = (tenantId || getCurrentTenantId() || "default").trim();
  const clean = raw.replace(/[^a-zA-Z0-9_-]/g, "_");
  return clean || "default";
}

