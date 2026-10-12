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
    if (PUBLIC_PATHS.some((p) => pathname?.startsWith(p))) return;

    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store", credentials: "same-origin" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (data.blocked) {
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
