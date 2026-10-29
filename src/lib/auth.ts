import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { adminEnabled, getAppMode, getSessionCookieName } from "@/lib/app-mode";
import { signSessionToken, verifySessionToken } from "@/lib/session-token";
import { setCurrentTenantId } from "@/lib/tenant-context";

export interface SessionUser {
  id: string;
  phone: string;
  role: "TENANT" | "SUPER_ADMIN";
  name?: string | null;
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
  try {
    const cookieStore = await cookies();
    const payload = verifySessionToken(cookieStore.get(getSessionCookieName())?.value);
    if (!payload || !isRoleAllowedHere(payload.role)) return null;

    if (payload.id) {
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
 * Verifies an active session for API routes and initializes the request's tenant context.
 */
export async function requireApiSession(): Promise<SessionUser | null> {
  return getSessionUser();
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
