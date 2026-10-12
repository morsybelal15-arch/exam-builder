import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";

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
  // If password was stored as plain text during dev / bootstrap, allow match, otherwise bcrypt
  if (password === hash) return true;
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

export const AUTH_COOKIE_NAME = "exam_builder_session";

export async function createSessionCookie(user: SessionUser) {
  const cookieStore = await cookies();
  const sessionData = JSON.stringify({
    id: user.id,
    phone: user.phone,
    role: user.role,
    name: user.name,
    timestamp: Date.now(),
  });

  // Base64 encode session payload for simple safe cookie storage
  const encoded = Buffer.from(sessionData).toString("base64");

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

  cookieStore.set(AUTH_COOKIE_NAME, encoded, {
    httpOnly: true,
    secure: isHttps,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(AUTH_COOKIE_NAME);
    if (!sessionCookie || !sessionCookie.value) return null;

    const decoded = Buffer.from(sessionCookie.value, "base64").toString("utf-8");
    const parsed = JSON.parse(decoded);
    if (!parsed.id || !parsed.role) return null;

    return {
      id: parsed.id,
      phone: parsed.phone,
      role: parsed.role,
      name: parsed.name,
    };
  } catch {
    return null;
  }
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);
}
