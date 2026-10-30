"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  isPathnameAllowedForFeatures,
  getFirstAllowedRoute,
} from "@/lib/app-features";
import {
  getCachedSession,
  getLastSessionFetchTime,
  setCachedSession,
  clearCachedSession,
} from "@/lib/client-session-cache";

const PUBLIC_PATHS = ["/login", "/denied", "/s"];

function isPublicOrAdminPath(path: string): boolean {
  if (!path) return true;
  if (path.startsWith("/admin")) return true;
  if (path === "/s" || path.startsWith("/s/")) return true;
  return PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`) || path.startsWith(`${p}?`));
}

/**
 * Re-validates the tenant's subscription and installed features with the server
 * on initial load, window focus, and periodic polling (every 25 seconds),
 * while using a 0ms client cache during in-app route transitions.
 */
export default function SubscriptionGuard() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const browserPath = typeof window !== "undefined" ? window.location.pathname : "";
    const activePath = pathname || browserPath;

    if (isPublicOrAdminPath(activePath)) {
      return;
    }

    let cancelled = false;

    const enforceRouteFeatures = (enabledFeatures: unknown) => {
      if (typeof window === "undefined" || !Array.isArray(enabledFeatures)) return;
      const currentPath = window.location.pathname;
      if (!isPathnameAllowedForFeatures(currentPath, enabledFeatures)) {
        const fallbackRoute = getFirstAllowedRoute(enabledFeatures);
        if (fallbackRoute && fallbackRoute !== currentPath) {
          router.replace(fallbackRoute);
        }
      }
    };

    // 1. Instant 0ms check from cached session on route change
    const cached = getCachedSession();
    if (cached && cached.authenticated) {
      enforceRouteFeatures(cached.enabledFeatures);
    }

    const check = async (force = false) => {
      if (typeof window !== "undefined" && isPublicOrAdminPath(window.location.pathname)) {
        return;
      }
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      // Throttle network re-fetches during rapid sidebar navigation (unless forced)
      if (!force && Date.now() - getLastSessionFetchTime() < 12_000) {
        return;
      }

      try {
        const res = await fetch(`/api/auth/session?t=${Date.now()}`, {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;

        if (data.blocked) {
          clearCachedSession();
          if (typeof window !== "undefined" && window.location.pathname.startsWith("/login")) {
            return;
          }
          if (typeof document !== "undefined") {
            document.cookie =
              "eb_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
            document.cookie =
              "eb_admin_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict";
            document.cookie =
              "auth_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
          }
          const reason = encodeURIComponent(data.reason || "");
          window.location.replace(`/login?blocked=${reason}`);
          return;
        }

        if (data.authenticated && typeof window !== "undefined") {
          setCachedSession(data);
          window.dispatchEvent(new CustomEvent("tenant-session-sync", { detail: data }));
          enforceRouteFeatures(data.enabledFeatures);
        }
      } catch {
        // Network hiccup — don't log the user out
      }
    };

    check(false);
    const onFocus = () => check(true);
    const onMutated = () => check(true);
    const onVisibility = () => {
      if (document.visibilityState === "visible") check(true);
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("tenant-data-mutated", onMutated);
    document.addEventListener("visibilitychange", onVisibility);
    const interval = window.setInterval(() => check(true), 25_000);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("tenant-data-mutated", onMutated);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(interval);
    };
  }, [pathname, router]);

  return null;
}
