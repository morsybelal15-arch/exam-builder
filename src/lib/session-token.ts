import { createHmac, timingSafeEqual } from "crypto";

/**
 * HMAC-SHA256 signed session tokens: `<base64url(json)>.<base64url(signature)>`.
 * Used by both proxy.ts (Node.js runtime) and server code, so a forged or
 * tampered cookie is rejected everywhere.
 */
export interface SessionPayload {
  id: string;
  phone: string;
  role: "TENANT" | "SUPER_ADMIN";
  name?: string | null;
  /** Expiry, epoch milliseconds */
  exp: number;
}

const DEV_FALLBACK_SECRET = "exam-builder-local-dev-only-secret-do-not-use-in-prod";

function getSecret(): string | null {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV !== "production") return DEV_FALLBACK_SECRET;
  return null;
}

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export function signSessionToken(payload: SessionPayload): string {
  const secret = getSecret();
  if (!secret) {
    throw new Error("SESSION_SECRET غير مضبوط على الخادم (يجب ألا يقل عن 32 حرفاً).");
  }
  const body = Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
  return `${body}.${sign(body, secret)}`;
}

export function verifySessionToken(token?: string | null): SessionPayload | null {
  if (!token) return null;
  const secret = getSecret();
  if (!secret) return null;

  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const signature = token.slice(dot + 1);

  const expected = Buffer.from(sign(body, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf-8")) as SessionPayload;
    if (!payload?.id || !payload.role || typeof payload.exp !== "number") return null;
    if (payload.role !== "TENANT" && payload.role !== "SUPER_ADMIN") return null;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
