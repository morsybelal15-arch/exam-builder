import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getSessionCookieName } from "@/lib/app-mode";
import { findTenantById, findTenantByPhone, getTenantAccessBlock } from "@/lib/tenants-repository";

export const dynamic = "force-dynamic";

/**
 * Live session validation.
 * Called by the client-side SubscriptionGuard on every page load / focus so that
 * admin actions (stop / expire / delete) take effect immediately for logged-in tenants.
 */
export async function GET() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ authenticated: false });
  }

  if (session.role === "SUPER_ADMIN") {
    return NextResponse.json({ authenticated: true, role: "SUPER_ADMIN" });
  }

  const tenant = (await findTenantById(session.id)) || (await findTenantByPhone(session.phone));
  const reason = getTenantAccessBlock(tenant);

  if (reason) {
    const res = NextResponse.json({ authenticated: false, blocked: true, reason });
    res.cookies.delete(getSessionCookieName());
    return res;
  }

  return NextResponse.json({
    authenticated: true,
    role: "TENANT",
    subscriptionDueDate: tenant?.subscriptionDueDate ?? null,
  });
}
