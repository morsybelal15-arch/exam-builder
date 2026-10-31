import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  findTenantByDomain,
  findTenantById,
  findTenantByPhone,
} from "@/lib/tenants-repository";
import {
  ingestTenantAnalyticsBatch,
  type AnalyticsIngestPayload,
} from "@/lib/analytics-repository";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session || !session.id) {
      return NextResponse.json({ ok: false }, { status: 200 });
    }

    const host = (req.headers.get("host") || "").split(":")[0].trim().toLowerCase();
    const isDedicatedTenantDomain = Boolean(
      host &&
        host !== "exambuilderapp.oqabagency.com" &&
        host !== "exambuilderadmin.oqabagency.com" &&
        host !== "localhost" &&
        host !== "127.0.0.1"
    );

    if (session.role === "SUPER_ADMIN" && !isDedicatedTenantDomain) {
      return NextResponse.json({ ok: true, skipped: true }, { status: 200 });
    }

    const domainTenant = isDedicatedTenantDomain ? await findTenantByDomain(host) : null;
    const userTenant =
      (await findTenantById(session.id)) || (await findTenantByPhone(session.phone));
    const tenant = isDedicatedTenantDomain ? domainTenant : userTenant || domainTenant;
    const effectiveTenantId = tenant?.id || session.id;

    let body: AnalyticsIngestPayload | null = null;
    try {
      const text = await req.text();
      if (text) body = JSON.parse(text);
    } catch {
      body = null;
    }

    if (body && effectiveTenantId) {
      ingestTenantAnalyticsBatch(
        effectiveTenantId,
        {
          name: tenant?.name || session.name,
          phone: tenant?.phone || session.phone,
          domain: tenant?.domain || null,
          subscriptionType: tenant?.subscriptionType || "سنتر",
        },
        body
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}

