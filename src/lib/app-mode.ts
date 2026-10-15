/**
 * Deployment mode of this Next.js process.
 *
 *  - "tenant": serves teacher domains only. Every admin route / action is disabled.
 *  - "admin" : serves the single Super Admin domain only (ADMIN_HOST). Tenant app is disabled.
 *  - "all"   : local development convenience â€” both sides enabled (never use on the VPS).
 *
 * When APP_MODE is not set, production defaults to the safe "tenant" mode and
 * development defaults to "all" so the local workflow keeps working.
 *
 * This file must stay free of Node-only imports: it is used by proxy.ts as well.
 */
export type AppMode = "tenant" | "admin" | "all";

export function getAppMode(): AppMode {
  const raw = (process.env.APP_MODE || "").trim().toLowerCase();
  if (raw === "admin" || raw === "tenant" || raw === "all") return raw;
  return process.env.NODE_ENV === "production" ? "tenant" : "all";
}

/** True when this process is allowed to serve the Super Admin dashboard. */
export function adminEnabled(): boolean {
  const mode = getAppMode();
  return mode === "admin" || mode === "all";
}

/** True when this process is allowed to serve the tenant (teacher) app. */
export function tenantEnabled(): boolean {
  const mode = getAppMode();
  return mode === "tenant" || mode === "all";
}

/** Hostname of the dedicated admin domain, e.g. exambuilderadmin.oqabagency.com */
export function getAdminHost(): string | null {
  const host = (process.env.ADMIN_HOST || "").trim().toLowerCase();
  return host || null;
}

/** Session cookie name â€” different per mode so admin & tenant sessions never mix. */
export function getSessionCookieName(): string {
  return getAppMode() === "admin" ? "eb_admin_session" : "eb_session";
}
