import React from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getTenantsList } from "@/lib/tenants-repository";
import { getAggregatedAnalyticsSummary } from "@/lib/analytics-repository";
import AdminAnalyticsClient from "@/components/admin/AdminAnalyticsClient";

export const dynamic = "force-dynamic";

export default async function AdminGlobalAnalyticsPage() {
  const session = await getSessionUser();
  if (!session || session.role !== "SUPER_ADMIN") {
    redirect("/login");
  }

  const tenantsList = await getTenantsList();
  const summary = getAggregatedAnalyticsSummary(tenantsList);

  return <AdminAnalyticsClient initialSummary={summary} />;
}

