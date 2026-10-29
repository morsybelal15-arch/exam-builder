import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { adminEnabled, getAppMode, getSessionCookieName } from "@/lib/app-mode";
import { signSessionToken, verifySessionToken } from "@/lib/session-token";
import { initTenantContextBox, setCurrentTenantId } from "@/lib/tenant-context";
import {
  findTenantByDomain,
  findTenantById,
  findTenantByPhone,
  getTenantAccessBlock,
} from "@/lib/tenants-repository";

export interface SessionUser {
  id: string;
  phone: string;
  role: "TENANT" | "SUPER_ADMIN";
  name?: string | null;
}

function isDedicatedTenantHost(host: string): boolean {
  return Boolean(
    host &&
      host !== "exambuilderapp.oqabagency.com" &&
      host !== "exambuilderadmin.oqabagency.com" &&
      host !== "localhost" &&
      host !== "127.0.0.1"
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

const TENANT_SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
const ADMIN_SESSION_MAX_AGE = 60 * 60 * 12; // 12 hours

/**
 * Whether a role may hold a session on this process:
 * tenant processes never accept SUPER_ADMIN, the admin process never accepts TENANT.
 */
export function isRoleAllowedHere(role: SessionUser["role"]): boolean {
  const mode = getAppMode();
  if (mode === "tenant") return role === "TENANT";
  if (mode === "admin") return role === "SUPER_ADMIN";
  return true;
}

export async function createSessionCookie(user: SessionUser) {
  if (!isRoleAllowedHere(user.role)) {
    throw new Error("لا يمكن تسجيل الدخول بهذا الحساب على هذا النطاق.");
  }

  const cookieStore = await cookies();
  const isAdmin = user.role === "SUPER_ADMIN";
  const maxAge = isAdmin ? ADMIN_SESSION_MAX_AGE : TENANT_SESSION_MAX_AGE;

  const token = signSessionToken({
    id: user.id,
    phone: user.phone,
    role: user.role,
    name: user.name,
    exp: Date.now() + maxAge * 1000,
  });

  // Only mark the cookie as Secure when the request actually arrived over HTTPS.
  // Tenant domains may be served over plain HTTP (behind Nginx), and browsers
  // silently DROP Secure cookies on HTTP — which causes an endless login loop.
  let isHttps = false;
  try {
    const h = await headers();
    const proto = h.get("x-forwarded-proto") || "";
    isHttps = proto.split(",")[0].trim() === "https";
  } catch {
    isHttps = false;
  }

  // Host-only cookie (no `domain` attribute) so a session never leaks to other subdomains.
  cookieStore.set(getSessionCookieName(), token, {
    httpOnly: true,
    secure: isHttps || getAppMode() === "admin",
    sameSite: isAdmin ? "strict" : "lax",
    path: "/",
    maxAge,
  });
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const ctxBox = initTenantContextBox();
  try {
    const cookieStore = await cookies();
    const payload = verifySessionToken(cookieStore.get(getSessionCookieName())?.value);
    if (!payload || !isRoleAllowedHere(payload.role)) return null;

    let host = "";
    try {
      const h = await headers();
      host = (h.get("host") || "").split(":")[0].trim().toLowerCase();
    } catch {
      host = "";
    }

    if (isDedicatedTenantHost(host)) {
      const domainTenant = await findTenantByDomain(host);
      if (domainTenant) {
        if (
          payload.role === "TENANT" &&
          payload.id !== domainTenant.id &&
          payload.phone !== domainTenant.phone
        ) {
          return null;
        }
        ctxBox.tenantId = domainTenant.id;
        setCurrentTenantId(domainTenant.id);
        return {
          id: domainTenant.id,
          phone: domainTenant.phone,
          role: payload.role,
          name: domainTenant.name || payload.name,
        };
      }
    }

    if (payload.id) {
      ctxBox.tenantId = payload.id;
      setCurrentTenantId(payload.id);
    }

    return {
      id: payload.id,
      phone: payload.phone,
      role: payload.role,
      name: payload.name,
    };
  } catch {
    return null;
  }
}

/**
 * Verifies an active session AND active subscription for API routes,
 * initializing the request's isolated tenant context.
 */
export async function requireApiSession(): Promise<SessionUser | null> {
  const ctxBox = initTenantContextBox();
  const session = await getSessionUser();
  if (!session) return null;

  if (session.role === "TENANT") {
    const tenant =
      (await findTenantById(session.id)) || (await findTenantByPhone(session.phone));
    const blockReason = getTenantAccessBlock(tenant);
    if (blockReason || !tenant) {
      return null;
    }
    ctxBox.tenantId = tenant.id;
    setCurrentTenantId(tenant.id);
    return {
      id: tenant.id,
      phone: tenant.phone,
      role: "TENANT",
      name: tenant.name || session.name,
    };
  }

  if (session.id) {
    ctxBox.tenantId = session.id;
    setCurrentTenantId(session.id);
  }
  return session;
}

/** Throws unless the caller is the Super Admin on a process where admin is enabled. */
export async function requireSuperAdmin(): Promise<SessionUser> {
  if (!adminEnabled()) {
    throw new Error("هذه العملية غير متاحة على هذا النطاق.");
  }
  const session = await getSessionUser();
  if (!session || session.role !== "SUPER_ADMIN") {
    throw new Error("غير مصرح لك بتنفيذ هذه العملية. يتطلب صلاحية مدير النظام (SUPER_ADMIN).");
  }
  return session;
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(getSessionCookieName());
}
