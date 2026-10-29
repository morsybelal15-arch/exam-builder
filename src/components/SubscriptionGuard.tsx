"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  isPathnameAllowedForFeatures,
  getFirstAllowedRoute,
} from "@/lib/app-features";

const PUBLIC_PATHS = ["/login", "/denied", "/s"];

function isPublicOrAdminPath(path: string): boolean {
  if (!path) return true;
  if (path.startsWith("/admin")) return true;
  if (path === "/s" || path.startsWith("/s/")) return true;
  return PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`) || path.startsWith(`${p}?`));
}

/**
 * Re-validates the tenant's subscription and installed features with the server
 * on navigation, window focus, and periodic polling (every 12 seconds).
 *
 * - If the Super Admin stopped / expired / deleted the account, the user is logged out immediately.
 * - If the Super Admin updated client name, subscription type, or installed features, dispatches
 *   `tenant-session-sync` so `Sidebar` and `TopHeaderBar` update live without page reload.
 * - If the user is on a route whose feature is not installed (`enabledFeatures`), redirects
 *   immediately to their first installed feature.
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

    const check = async () => {
      if (typeof window !== "undefined" && isPublicOrAdminPath(window.location.pathname)) {
        return;
      }
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
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
          window.dispatchEvent(new CustomEvent("tenant-session-sync", { detail: data }));

          if (Array.isArray(data.enabledFeatures)) {
            const currentPath = window.location.pathname;
            if (!isPathnameAllowedForFeatures(currentPath, data.enabledFeatures)) {
              const fallbackRoute = getFirstAllowedRoute(data.enabledFeatures);
              if (fallbackRoute && fallbackRoute !== currentPath) {
                router.replace(fallbackRoute);
              }
            }
          }
        }
      } catch {
        // Network hiccup — don't log the user out
      }
    };

    check();
    const onFocus = () => check();
    const onVisibility = () => {
      if (document.visibilityState === "visible") check();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    const interval = window.setInterval(check, 25_000);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(interval);
    };
  }, [pathname, router]);

  return null;
}
