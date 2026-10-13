import { scryptSync, randomBytes, timingSafeEqual } from "crypto";

/**
 * The single Super Admin account is defined only through server environment variables:
 *   ADMIN_PHONE          e.g. 01xxxxxxxxx
 *   ADMIN_PASSWORD_HASH  scrypt:<saltHex>:<hashHex>   (generate with: node scripts/hash-admin-password.mjs "<password>")
 *   ADMIN_NAME           optional display name
 *
 * The scrypt format intentionally contains no "$" characters so it is safe inside .env files.
 */
export const ADMIN_ID = "admin-master";

export function hashAdminPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

function verifyScrypt(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split(":");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function isAdminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PHONE && process.env.ADMIN_PASSWORD_HASH);
}

/** Returns the admin identity when phone + password match the configured admin, otherwise null. */
export function verifyAdminCredentials(
  phone: string,
  password: string
): { id: string; phone: string; name: string } | null {
  const adminPhone = (process.env.ADMIN_PHONE || "").trim();
  const adminHash = (process.env.ADMIN_PASSWORD_HASH || "").trim();
  if (!adminPhone || !adminHash) return null;
  if (phone.trim() !== adminPhone) return null;
  try {
    if (!verifyScrypt(password, adminHash)) return null;
  } catch {
    return null;
  }
  return { id: ADMIN_ID, phone: adminPhone, name: process.env.ADMIN_NAME || "مدير النظام" };
}
