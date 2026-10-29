import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getSessionCookieName } from "@/lib/app-mode";
import { findTenantById, findTenantByPhone, getTenantAccessBlock } from "@/lib/tenants-repository";
import { getStudents, getGroups } from "@/lib/management-db";
import { getLocalUploadedFiles } from "@/lib/db";
import {
  ALL_FEATURE_IDS,
  normalizeEnabledFeatures,
  getFirstAllowedRoute,
} from "@/lib/app-features";

export const dynamic = "force-dynamic";

/**
 * Live session validation & real-time tenant configuration sync.
 * Called by SubscriptionGuard, Sidebar, and TopHeaderBar so that any Super Admin action
 * (updating client name, dates, subscription type, enabled features, or stopping/resuming)
 * takes effect immediately for logged-in tenants without requiring a re-login.
 */
export async function GET() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ authenticated: false });
  }

  let studentsCount = 0;
  let activeStudentsCount = 0;
  let groupsCount = 0;
  let filesBytes = 0;
  try {
    const stds = getStudents();
    studentsCount = stds.length;
    activeStudentsCount = stds.filter((s) => s.status === "active").length;
    groupsCount = getGroups().length;
    const files = getLocalUploadedFiles();
    filesBytes = files.reduce((acc: number, f: any) => acc + (Number(f.size) || 0), 0);
  } catch {
    // non-fatal
  }

  if (session.role === "SUPER_ADMIN") {
    return NextResponse.json({
      authenticated: true,
      role: "SUPER_ADMIN",
      name: session.name || "المدير العام (Super Admin)",
      subscriptionType: "سنتر",
      enabledFeatures: ALL_FEATURE_IDS,
      firstAllowedRoute: "/",
      storageLimitBytes: 10 * 1073741824,
      usage: {
        studentsCount,
        activeStudentsCount,
        groupsCount,
        filesBytes,
      },
    });
  }

  const tenant = (await findTenantById(session.id)) || (await findTenantByPhone(session.phone));
  const reason = getTenantAccessBlock(tenant);

  if (reason) {
    const res = NextResponse.json({ authenticated: false, blocked: true, reason });
    res.cookies.set(getSessionCookieName(), "", {
      path: "/",
      maxAge: 0,
      expires: new Date(0),
      httpOnly: true,
      sameSite: "lax",
    });
    return res;
  }

  const enabledFeatures = normalizeEnabledFeatures(tenant?.enabledFeatures);

  return NextResponse.json({
    authenticated: true,
    role: "TENANT",
    name: tenant?.name || session.name || "العميل المشترك",
    phone: tenant?.phone || session.phone,
    domain: tenant?.domain || null,
    planType: tenant?.planType || "باقة إدارة السنتر المتكاملة",
    subscriptionType: tenant?.subscriptionType || "سنتر",
    subscriptionStartDate: tenant?.subscriptionStartDate ?? tenant?.createdAt ?? null,
    subscriptionDueDate: tenant?.subscriptionDueDate ?? null,
    enabledFeatures,
    firstAllowedRoute: getFirstAllowedRoute(enabledFeatures),
    storageLimitBytes: Number(tenant?.storageLimitBytes || 1073741824),
    usage: {
      studentsCount,
      activeStudentsCount,
      groupsCount,
      filesBytes,
    },
  });
}
