import type { Metadata } from "next";
import { getAppMode } from "@/lib/app-mode";
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

export default function LoginPage() {
  return <LoginForm isAdmin={getAppMode() === "admin"} />;
}
