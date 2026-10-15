"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const PUBLIC_PATHS = ["/login", "/denied"];

/**
 * Re-validates the tenant's subscription with the server on navigation and window focus.
 * If the admin stopped / expired / deleted the account, the user is logged out immediately
 * and sent to the login page with the reason.
 */
export default function SubscriptionGuard() {
  const pathname = usePathname();

  useEffect(() => {
    // Check both Next.js pathname and browser window location
    const browserPath = typeof window !== "undefined" ? window.location.pathname : "";
    const activePath = pathname || browserPath;

    // NEVER run on login, denied, or admin pages
    if (
      !activePath ||
      PUBLIC_PATHS.some((p) => activePath.startsWith(p)) ||
      activePath.startsWith("/admin")
    ) {
      return;
    }

    let cancelled = false;

    const check = async () => {
      // Abort if the user is already on a public path
      if (
        typeof window !== "undefined" &&
        (PUBLIC_PATHS.some((p) => window.location.pathname.startsWith(p)) ||
          window.location.pathname.startsWith("/admin"))
      ) {
        return;
      }

      try {
        const res = await fetch("/api/auth/session", { cache: "no-store", credentials: "same-origin" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;

        if (data.blocked) {
          // If we are already on login, do nothing
          if (typeof window !== "undefined" && window.location.pathname.startsWith("/login")) {
            return;
          }
          // Clear any client cookie if possible
          if (typeof document !== "undefined") {
            document.cookie = "auth_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
          }
          const reason = encodeURIComponent(data.reason || "");
          window.location.replace(`/login?blocked=${reason}`);
        }
      } catch {
        // Network hiccup — don't log the user out
      }
    };

    check();
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);
    const interval = window.setInterval(check, 60_000);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      window.clearInterval(interval);
    };
  }, [pathname]);

  return null;
}
