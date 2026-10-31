"use server";

import { requireSuperAdmin } from "@/lib/auth";
import { getTenantsList } from "@/lib/tenants-repository";
import {
  getTenantAnalytics,
  resetTenantAnalytics,
  getAggregatedAnalyticsSummary,
  type TenantAnalyticsRecord,
  type AggregatedAnalyticsSummary,
} from "@/lib/analytics-repository";

export async function getTenantAnalyticsAction(
  tenantId: string
): Promise<{ success: boolean; data?: TenantAnalyticsRecord; error?: string }> {
  try {
    await requireSuperAdmin();
    const data = getTenantAnalytics(tenantId);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || "فشل جلب بيانات التتبع" };
  }
}

export async function resetTenantAnalyticsAction(
  tenantId: string
): Promise<{ success: boolean; data?: TenantAnalyticsRecord; error?: string }> {
  try {
    await requireSuperAdmin();
    const data = resetTenantAnalytics(tenantId);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || "فشل تصفير بيانات التتبع" };
  }
}

export async function getAggregatedAnalyticsAction(): Promise<{
  success: boolean;
  data?: AggregatedAnalyticsSummary;
  error?: string;
}> {
  try {
    await requireSuperAdmin();
    const tenants = await getTenantsList();
    const data = getAggregatedAnalyticsSummary(tenants);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || "فشل جلب التحليلات المجمعة" };
  }
}

