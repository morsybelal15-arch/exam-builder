"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

function isTrackableTenantPath(path: string): boolean {
  if (!path) return false;
  if (
    path.startsWith("/admin") ||
    path.startsWith("/login") ||
    path.startsWith("/denied") ||
    path === "/s" ||
    path.startsWith("/s/")
  ) {
    return false;
  }
  return true;
}

function getCurrentCairoHour(): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Africa/Cairo",
      hour: "numeric",
      hour12: false,
    }).formatToParts(new Date());
    const h = Number(parts.find((p) => p.type === "hour")?.value || 0) % 24;
    return String(h);
  } catch {
    return String(new Date().getHours());
  }
}

function extractReadableClickLabel(el: HTMLElement): string | null {
  const explicit =
    el.getAttribute("data-track") ||
    el.getAttribute("aria-label") ||
    el.getAttribute("title");
  if (explicit && explicit.trim().length > 1) {
    return explicit.replace(/\s+/g, " ").trim().slice(0, 65);
  }

  const rawText = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
  if (!rawText || rawText.length < 2) return null;
  if (rawText.length > 65) {
    return rawText.slice(0, 62) + "...";
  }
  return rawText;
}

export default function TenantAnalyticsTracker() {
  const pathname = usePathname() || "/";
  const currentPathRef = useRef<string>(pathname);
  const lastInteractionMsRef = useRef<number>(Date.now());
  const isFlushingRef = useRef<boolean>(false);

  const bufferRef = useRef<{
    isNewSession: boolean;
    activeSecondsByPath: Record<string, number>;
    pageViews: Record<string, number>;
    clicksMap: Record<string, { label: string; path: string; count: number; ts: string }>;
    hourlySeconds: Record<string, number>;
    recentEvents: Array<{
      type: "view" | "click" | "session";
      label: string;
      path: string;
      timestamp: string;
    }>;
    hasData: boolean;
  }>({
    isNewSession: false,
    activeSecondsByPath: {},
    pageViews: {},
    clicksMap: {},
    hourlySeconds: {},
    recentEvents: [],
    hasData: false,
  });

  const flushBuffer = (useBeacon = false) => {
    const buf = bufferRef.current;
    if (!buf.hasData || isFlushingRef.current) return;
    if (!isTrackableTenantPath(currentPathRef.current)) return;

    const payload = {
      isNewSession: buf.isNewSession,
      deviceType:
        typeof window !== "undefined" && window.innerWidth < 768 ? "mobile" : "desktop",
      theme:
        (typeof document !== "undefined" &&
          document.documentElement.getAttribute("data-theme")) ||
        (typeof localStorage !== "undefined" && localStorage.getItem("app_theme_preset")) ||
        "default",
      currentPath: currentPathRef.current,
      activeSecondsByPath: { ...buf.activeSecondsByPath },
      pageViews: { ...buf.pageViews },
      clicks: Object.values(buf.clicksMap),
      hourlySeconds: { ...buf.hourlySeconds },
      recentEvents: [...buf.recentEvents],
    };

    // Reset buffer immediately
    bufferRef.current = {
      isNewSession: false,
      activeSecondsByPath: {},
      pageViews: {},
      clicksMap: {},
      hourlySeconds: {},
      recentEvents: [],
      hasData: false,
    };

    const jsonBody = JSON.stringify(payload);

    try {
      if (useBeacon && typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        const blob = new Blob([jsonBody], { type: "application/json" });
        navigator.sendBeacon("/api/analytics/ingest", blob);
        return;
      }

      isFlushingRef.current = true;
      fetch("/api/analytics/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: jsonBody,
        keepalive: true,
        credentials: "same-origin",
      })
        .catch(() => {})
        .finally(() => {
          isFlushingRef.current = false;
        });
    } catch {
      isFlushingRef.current = false;
    }
  };

  // Track route / page views
  useEffect(() => {
    currentPathRef.current = pathname;
    if (!isTrackableTenantPath(pathname)) return;

    lastInteractionMsRef.current = Date.now();
    const buf = bufferRef.current;

    try {
      const sessionKey = "eb_analytics_session_started_v1";
      if (!sessionStorage.getItem(sessionKey)) {
        sessionStorage.setItem(sessionKey, "1");
        buf.isNewSession = true;
        buf.recentEvents.push({
          type: "session",
          label: "بدء جلسة استخدام جديدة",
          path: pathname,
          timestamp: new Date().toISOString(),
        });
      }
    } catch {
      // ignore storage errors
    }

    buf.pageViews[pathname] = (buf.pageViews[pathname] || 0) + 1;
    buf.recentEvents.push({
      type: "view",
      label: `فتح صفحة (${pathname === "/" ? "الرئيسية" : pathname})`,
      path: pathname,
      timestamp: new Date().toISOString(),
    });
    if (buf.recentEvents.length > 20) {
      buf.recentEvents = buf.recentEvents.slice(-20);
    }
    buf.hasData = true;

    // Quick initial flush after route navigation so Admin sees live navigation quickly
    const timer = window.setTimeout(() => {
      flushBuffer(false);
    }, 3500);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  // Passive listeners for clicks, activity heartbeat, and background batch flushing
  useEffect(() => {
    if (typeof window === "undefined") return;

    const markActive = () => {
      lastInteractionMsRef.current = Date.now();
    };

    const onClick = (e: MouseEvent) => {
      const path = currentPathRef.current;
      if (!isTrackableTenantPath(path)) return;
      lastInteractionMsRef.current = Date.now();

      const target = e.target as HTMLElement | null;
      if (!target || typeof target.closest !== "function") return;
      const interactive = target.closest(
        'button, a, [role="button"], input[type="submit"], input[type="button"]'
      ) as HTMLElement | null;
      if (!interactive) return;

      const label = extractReadableClickLabel(interactive);
      if (!label) return;

      const buf = bufferRef.current;
      const key = `${path}::${label}`;
      const nowIso = new Date().toISOString();
      if (!buf.clicksMap[key]) {
        buf.clicksMap[key] = { label, path, count: 0, ts: nowIso };
      }
      buf.clicksMap[key].count += 1;
      buf.clicksMap[key].ts = nowIso;

      buf.recentEvents.push({
        type: "click",
        label,
        path,
        timestamp: nowIso,
      });
      if (buf.recentEvents.length > 20) {
        buf.recentEvents = buf.recentEvents.slice(-20);
      }
      buf.hasData = true;
    };

    // 1-second active duration counter (only counts when tab is visible and user is not idle > 3 mins)
    const activeTimer = window.setInterval(() => {
      const path = currentPathRef.current;
      if (!isTrackableTenantPath(path)) return;
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastInteractionMsRef.current > 180_000) return;

      const buf = bufferRef.current;
      buf.activeSecondsByPath[path] = (buf.activeSecondsByPath[path] || 0) + 1;
      const h = getCurrentCairoHour();
      buf.hourlySeconds[h] = (buf.hourlySeconds[h] || 0) + 1;
      buf.hasData = true;
    }, 1000);

    // Periodic silent background flush every 25 seconds
    const flushTimer = window.setInterval(() => {
      flushBuffer(false);
    }, 25_000);

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushBuffer(true);
      } else {
        lastInteractionMsRef.current = Date.now();
      }
    };

    const onPageHide = () => {
      flushBuffer(true);
    };

    window.addEventListener("mousemove", markActive, { passive: true });
    window.addEventListener("keydown", markActive, { passive: true });
    window.addEventListener("scroll", markActive, { passive: true });
    window.addEventListener("touchstart", markActive, { passive: true });
    document.addEventListener("click", onClick, { passive: true, capture: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      window.clearInterval(activeTimer);
      window.clearInterval(flushTimer);
      window.removeEventListener("mousemove", markActive);
      window.removeEventListener("keydown", markActive);
      window.removeEventListener("scroll", markActive);
      window.removeEventListener("touchstart", markActive);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, []);

  return null;
}

