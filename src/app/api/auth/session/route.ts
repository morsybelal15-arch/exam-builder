import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getSessionCookieName } from "@/lib/app-mode";
import { setCurrentTenantId } from "@/lib/tenant-context";
import {
  findTenantById,
  findTenantByPhone,
  findTenantByDomain,
  getTenantAccessBlock,
} from "@/lib/tenants-repository";
import { getStudents, getGroups } from "@/lib/management-db";
import { getLocalUploadedFiles, getTenantUsageStats } from "@/lib/db";
import {
  ALL_FEATURE_IDS,
  normalizeEnabledFeatures,
  getFirstAllowedRoute,
} from "@/lib/app-features";

export const dynamic = "force-dynamic";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

/**
 * Live session validation & real-time tenant configuration sync.
 * Called by SubscriptionGuard, Sidebar, and TopHeaderBar so that any Super Admin action
 * (updating client name, dates, subscription type, enabled features, or stopping/resuming)
 * takes effect immediately for logged-in tenants without requiring a re-login.
 */
export async function GET(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { headers: NO_CACHE_HEADERS });
  }

  const host = (req.headers.get("host") || "").split(":")[0].trim().toLowerCase();
  const domainTenant = host ? await findTenantByDomain(host) : null;
  const userTenant =
    (await findTenantById(session.id)) || (await findTenantByPhone(session.phone));

  const isDedicatedTenantDomain = Boolean(
    domainTenant &&
      host !== "exambuilderapp.oqabagency.com" &&
      host !== "exambuilderadmin.oqabagency.com" &&
      host !== "localhost" &&
      host !== "127.0.0.1"
  );

  if (
    isDedicatedTenantDomain &&
    session.role === "TENANT" &&
    domainTenant &&
    userTenant &&
    userTenant.id !== domainTenant.id
  ) {
    const res = NextResponse.json({ authenticated: false }, { headers: NO_CACHE_HEADERS });
    res.cookies.set(getSessionCookieName(), "", {
      path: "/",
      maxAge: 0,
      expires: new Date(0),
      httpOnly: true,
      sameSite: "lax",
    });
    return res;
  }

  const tenant = isDedicatedTenantDomain ? domainTenant : userTenant || domainTenant;
  if (tenant?.id) {
    setCurrentTenantId(tenant.id);
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
    filesBytes = tenant?.id ? getTenantUsageStats(tenant.id).usedStorageBytes : 0;
  } catch {
    // non-fatal
  }

  if (!tenant && session.role === "SUPER_ADMIN") {
    return NextResponse.json(
      {
        authenticated: true,
        role: "SUPER_ADMIN",
        name: session.name || "المدير العام (Super Admin)",
        subscriptionType: "سنتر",
        enabledFeatures: ALL_FEATURE_IDS,
        firstAllowedRoute: "/",
        storageLimitBytes: 100 * 1024 * 1024,
        notes: null,
        usage: {
          studentsCount,
          activeStudentsCount,
          groupsCount,
          filesBytes,
        },
      },
      { headers: NO_CACHE_HEADERS }
    );
  }

  const reason = getTenantAccessBlock(
    tenant
      ? {
          ...tenant,
          // Enforce access block even if a super admin session is viewing a stopped tenant's domain
          role: "TENANT",
        }
      : null
  );

  if (reason) {
    const res = NextResponse.json(
      { authenticated: false, blocked: true, reason },
      { headers: NO_CACHE_HEADERS }
    );
    if (session.role !== "SUPER_ADMIN" || isDedicatedTenantDomain) {
      res.cookies.set(getSessionCookieName(), "", {
        path: "/",
        maxAge: 0,
        expires: new Date(0),
        httpOnly: true,
        sameSite: "lax",
      });
    }
    return res;
  }

  const enabledFeatures = normalizeEnabledFeatures(tenant?.enabledFeatures);

  return NextResponse.json(
    {
      authenticated: true,
      role: session.role === "SUPER_ADMIN" && !isDedicatedTenantDomain ? "SUPER_ADMIN" : "TENANT",
      name: tenant?.name || session.name || "العميل المشترك",
      phone: tenant?.phone || session.phone,
      domain: tenant?.domain || null,
      planType: tenant?.planType || "باقة إدارة السنتر المتكاملة",
      subscriptionType: tenant?.subscriptionType || "سنتر",
      subscriptionStartDate: tenant?.subscriptionStartDate ?? tenant?.createdAt ?? null,
      subscriptionDueDate: tenant?.subscriptionDueDate ?? null,
      enabledFeatures,
      firstAllowedRoute: getFirstAllowedRoute(enabledFeatures),
      storageLimitBytes: Number(tenant?.storageLimitBytes || 100 * 1024 * 1024),
      notes: tenant?.notes || null,
      usage: {
        studentsCount,
        activeStudentsCount,
        groupsCount,
        filesBytes,
      },
    },
    { headers: NO_CACHE_HEADERS }
  );
}
