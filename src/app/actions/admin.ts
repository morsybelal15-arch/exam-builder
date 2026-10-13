"use server";

import { toggleTenantStatusAction as toggleTenantStatus } from "@/app/actions/admin-tenants";

/**
 * Legacy entry point used by TenantStatusToggle. Delegates to the main tenant
 * repository action (works with both PostgreSQL and the tenants.json store,
 * and is guarded by requireSuperAdmin + admin mode).
 */
export async function toggleTenantStatusAction(tenantId: string) {
  const res = await toggleTenantStatus(tenantId);
  if ("error" in res && res.error) throw new Error(res.error);
  return { success: true, newStatus: (res as any).newStatus };
}
