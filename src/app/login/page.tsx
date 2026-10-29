import type { Metadata } from "next";
import { headers } from "next/headers";
import { getAppMode } from "@/lib/app-mode";
import { findTenantByDomain } from "@/lib/tenants-repository";
import LoginForm from "./LoginForm";

export async function generateMetadata(): Promise<Metadata> {
  // Tenant domains keep the layout title (checkTenantDomainOnVps looks for it in the HTML).
  if (getAppMode() !== "admin") return {};
  return {
    title: "دخول مدير النظام",
    robots: { index: false, follow: false },
  };
}

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  let tenantName: string | null = null;
  let subscriptionType: string | null = null;
  try {
    const h = await headers();
    const host = h.get("host") || "";
    const tenant = await findTenantByDomain(host);
    if (tenant) {
      tenantName = tenant.name;
      subscriptionType = tenant.subscriptionType || null;
    }
  } catch {
    // non-fatal
  }

  return (
    <LoginForm
      isAdmin={getAppMode() === "admin"}
      tenantName={tenantName}
      subscriptionType={subscriptionType}
    />
  );
}
