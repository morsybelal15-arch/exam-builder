import fs from "fs";
import path from "path";
import type { StoredTenant } from "@/lib/tenants-repository";

export interface PageVisitStat {
  path: string;
  title: string;
  views: number;
  activeSeconds: number;
  clicks: number;
  lastVisitAt: string;
}

export interface ClickActionStat {
  key: string;
  label: string;
  path: string;
  pageTitle: string;
  count: number;
  lastClickedAt: string;
}

export interface DailyUsageStat {
  date: string; // YYYY-MM-DD
  activeSeconds: number;
  views: number;
  clicks: number;
  sessions: number;
}

export interface RecentActivityEvent {
  type: "view" | "click" | "session";
  label: string;
  path: string;
  pageTitle: string;
  timestamp: string;
}

export interface TenantAnalyticsRecord {
  tenantId: string;
  tenantName?: string;
  phone?: string;
  domain?: string | null;
  subscriptionType?: string;
  totalActiveSeconds: number;
  totalSessions: number;
  totalPageViews: number;
  totalClicks: number;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  lastPath: string | null;
  lastPageTitle: string | null;
  lastActionLabel: string | null;
  preferredTheme: string;
  devices: {
    desktop: number;
    mobile: number;
  };
  pages: Record<string, PageVisitStat>;
  topClicks: Record<string, ClickActionStat>;
  hourlySeconds: Record<string, number>; // "0".."23"
  hourlyClicks: Record<string, number>; // "0".."23"
  weekdaySeconds: Record<string, number>; // "0".."6" (0=Sunday .. 6=Saturday)
  dailyHistory: Record<string, DailyUsageStat>; // YYYY-MM-DD -> stats
  recentEvents: RecentActivityEvent[];
}

export interface AnalyticsIngestPayload {
  isNewSession?: boolean;
  deviceType?: "desktop" | "mobile";
  theme?: string;
  currentPath?: string;
  activeSecondsByPath?: Record<string, number>;
  pageViews?: Record<string, number>;
  clicks?: Array<{
    label: string;
    path: string;
    count: number;
    ts?: string;
  }>;
  hourlySeconds?: Record<string, number>;
  hourlyClicks?: Record<string, number>;
  recentEvents?: Array<{
    type: "view" | "click" | "session";
    label: string;
    path: string;
    timestamp: string;
  }>;
}

const DATA_DIR = path.join(process.cwd(), "data");
const ANALYTICS_FILE = path.join(DATA_DIR, "tenant-analytics.json");

export const ARABIC_PAGE_TITLES: Record<string, string> = {
  "/": "الرئيسية والداشبورد",
  "/groups": "المجموعات الدراسية",
  "/students": "الطلاب والحسابات",
  "/qr-printing": "طباعة رموز QR",
  "/excel-sheets": "تصدير واستيراد Excel",
  "/exam-builder": "منشئ الاختبارات",
  "/created-exams": "الاختبارات المنشأة",
  "/uploaded-files": "الملفات المرفوعة",
  "/images-to-pdf": "تحويل الصور إلى PDF",
  "/my-subscription": "اشتراكي والباقة",
  "/subscription": "اشتراكي والباقة",
  "/how-to-use": "كيفية الاستخدام",
};

export function resolveArabicPageTitle(rawPath: string): string {
  const clean = (rawPath || "/").split("?")[0].trim() || "/";
  if (ARABIC_PAGE_TITLES[clean]) return ARABIC_PAGE_TITLES[clean];
  if (clean.startsWith("/students/")) return "ملف وبروفايل طالب";
  return clean;
}

export function normalizeTrackPath(rawPath: string): string {
  const clean = (rawPath || "/").split("?")[0].trim() || "/";
  if (clean === "/subscription") return "/my-subscription";
  if (clean.startsWith("/students/")) return "/students/[id]";
  return clean;
}

function getCairoDateAndHour(now = new Date()): {
  dateStr: string;
  hourStr: string;
  weekdayStr: string;
} {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Cairo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hour12: false,
      weekday: "short",
    }).formatToParts(now);

    const year = parts.find((p) => p.type === "year")?.value || "2026";
    const month = parts.find((p) => p.type === "month")?.value || "01";
    const day = parts.find((p) => p.type === "day")?.value || "01";
    const rawHour = Number(parts.find((p) => p.type === "hour")?.value || 0) % 24;
    const wk = parts.find((p) => p.type === "weekday")?.value || "Sun";
    const wkMap: Record<string, string> = {
      Sun: "0",
      Mon: "1",
      Tue: "2",
      Wed: "3",
      Thu: "4",
      Fri: "5",
      Sat: "6",
    };

    return {
      dateStr: `${year}-${month}-${day}`,
      hourStr: String(rawHour),
      weekdayStr: wkMap[wk] || String(now.getDay()),
    };
  } catch {
    return {
      dateStr: now.toISOString().split("T")[0],
      hourStr: String(now.getHours()),
      weekdayStr: String(now.getDay()),
    };
  }
}

export function createEmptyTenantAnalytics(tenantId: string): TenantAnalyticsRecord {
  return {
    tenantId,
    totalActiveSeconds: 0,
    totalSessions: 0,
    totalPageViews: 0,
    totalClicks: 0,
    firstSeenAt: null,
    lastSeenAt: null,
    lastPath: null,
    lastPageTitle: null,
    lastActionLabel: null,
    preferredTheme: "default",
    devices: {
      desktop: 0,
      mobile: 0,
    },
    pages: {},
    topClicks: {},
    hourlySeconds: {},
    hourlyClicks: {},
    weekdaySeconds: {},
    dailyHistory: {},
    recentEvents: [],
  };
}

const globalForAnalytics = globalThis as unknown as {
  __analyticsStore?: Record<string, TenantAnalyticsRecord>;
  __analyticsMtimeMs?: number;
  __analyticsLastStatCheck?: number;
  __analyticsLastDiskSave?: number;
  __analyticsPendingSaveTimer?: ReturnType<typeof setTimeout> | null;
};

function loadAnalyticsStore(forceStat = false): Record<string, TenantAnalyticsRecord> {
  const now = Date.now();
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(ANALYTICS_FILE)) {
      if (!globalForAnalytics.__analyticsStore) {
        globalForAnalytics.__analyticsStore = {};
      }
      return globalForAnalytics.__analyticsStore;
    }

    const shouldCheckMtime =
      forceStat ||
      !globalForAnalytics.__analyticsStore ||
      now - (globalForAnalytics.__analyticsLastStatCheck || 0) > 2000;

    if (shouldCheckMtime) {
      globalForAnalytics.__analyticsLastStatCheck = now;
      const stat = fs.statSync(ANALYTICS_FILE);
      if (
        !globalForAnalytics.__analyticsStore ||
        globalForAnalytics.__analyticsMtimeMs !== stat.mtimeMs
      ) {
        const raw = fs.readFileSync(ANALYTICS_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          globalForAnalytics.__analyticsStore = parsed;
          globalForAnalytics.__analyticsMtimeMs = stat.mtimeMs;
        }
      }
    }
  } catch {
    if (!globalForAnalytics.__analyticsStore) {
      globalForAnalytics.__analyticsStore = {};
    }
  }
  return globalForAnalytics.__analyticsStore || {};
}

function flushAnalyticsStoreToDisk(): void {
  try {
    if (!globalForAnalytics.__analyticsStore) return;
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tmp = `${ANALYTICS_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(globalForAnalytics.__analyticsStore), "utf-8");
    fs.renameSync(tmp, ANALYTICS_FILE);
    const stat = fs.statSync(ANALYTICS_FILE);
    globalForAnalytics.__analyticsMtimeMs = stat.mtimeMs;
    globalForAnalytics.__analyticsLastDiskSave = Date.now();
  } catch (err) {
    console.warn("Non-fatal error flushing analytics store:", err);
  }
}

function scheduleAnalyticsSave(immediate = false): void {
  if (immediate) {
    if (globalForAnalytics.__analyticsPendingSaveTimer) {
      clearTimeout(globalForAnalytics.__analyticsPendingSaveTimer);
      globalForAnalytics.__analyticsPendingSaveTimer = null;
    }
    flushAnalyticsStoreToDisk();
    return;
  }

  const now = Date.now();
  const elapsed = now - (globalForAnalytics.__analyticsLastDiskSave || 0);
  if (elapsed >= 4000) {
    flushAnalyticsStoreToDisk();
    return;
  }

  if (!globalForAnalytics.__analyticsPendingSaveTimer) {
    globalForAnalytics.__analyticsPendingSaveTimer = setTimeout(() => {
      globalForAnalytics.__analyticsPendingSaveTimer = null;
      flushAnalyticsStoreToDisk();
    }, 3500);
  }
}

export function ingestTenantAnalyticsBatch(
  tenantId: string,
  meta: {
    name?: string | null;
    phone?: string;
    domain?: string | null;
    subscriptionType?: string;
  },
  payload: AnalyticsIngestPayload
): void {
  if (!tenantId) return;
  const store = loadAnalyticsStore(false);
  const rec: TenantAnalyticsRecord = store[tenantId] || createEmptyTenantAnalytics(tenantId);

  const now = new Date();
  const nowIso = now.toISOString();
  const { dateStr, hourStr, weekdayStr } = getCairoDateAndHour(now);

  if (meta.name) rec.tenantName = meta.name;
  if (meta.phone) rec.phone = meta.phone;
  if (meta.domain !== undefined) rec.domain = meta.domain;
  if (meta.subscriptionType) rec.subscriptionType = meta.subscriptionType;

  if (!rec.firstSeenAt) rec.firstSeenAt = nowIso;
  rec.lastSeenAt = nowIso;

  if (payload.theme && typeof payload.theme === "string") {
    rec.preferredTheme = payload.theme.slice(0, 32);
  }

  if (!rec.dailyHistory[dateStr]) {
    rec.dailyHistory[dateStr] = {
      date: dateStr,
      activeSeconds: 0,
      views: 0,
      clicks: 0,
      sessions: 0,
    };
  }
  const todayBucket = rec.dailyHistory[dateStr];

  if (payload.isNewSession) {
    rec.totalSessions += 1;
    todayBucket.sessions += 1;
    if (payload.deviceType === "mobile") {
      rec.devices.mobile = (rec.devices.mobile || 0) + 1;
    } else {
      rec.devices.desktop = (rec.devices.desktop || 0) + 1;
    }
  } else if (rec.totalSessions === 0) {
    rec.totalSessions = 1;
    todayBucket.sessions = Math.max(1, todayBucket.sessions);
    if (payload.deviceType === "mobile") {
      rec.devices.mobile = Math.max(1, rec.devices.mobile || 0);
    } else {
      rec.devices.desktop = Math.max(1, rec.devices.desktop || 0);
    }
  }

  if (payload.currentPath) {
    const normCurrent = normalizeTrackPath(payload.currentPath);
    rec.lastPath = normCurrent;
    rec.lastPageTitle = resolveArabicPageTitle(normCurrent);
  }

  // 1. Merge Page Views
  if (payload.pageViews && typeof payload.pageViews === "object") {
    for (const [rawPath, rawCount] of Object.entries(payload.pageViews)) {
      const count = Math.min(200, Math.max(0, Math.floor(Number(rawCount) || 0)));
      if (count <= 0) continue;
      const normPath = normalizeTrackPath(rawPath);
      const title = resolveArabicPageTitle(normPath);
      if (!rec.pages[normPath]) {
        rec.pages[normPath] = {
          path: normPath,
          title,
          views: 0,
          activeSeconds: 0,
          clicks: 0,
          lastVisitAt: nowIso,
        };
      }
      rec.pages[normPath].views += count;
      rec.pages[normPath].lastVisitAt = nowIso;
      rec.totalPageViews += count;
      todayBucket.views += count;
      rec.lastPath = normPath;
      rec.lastPageTitle = title;
    }
  }

  // 2. Merge Active Seconds by Path
  let batchTotalSeconds = 0;
  if (payload.activeSecondsByPath && typeof payload.activeSecondsByPath === "object") {
    for (const [rawPath, rawSecs] of Object.entries(payload.activeSecondsByPath)) {
      const secs = Math.min(600, Math.max(0, Math.floor(Number(rawSecs) || 0)));
      if (secs <= 0) continue;
      const normPath = normalizeTrackPath(rawPath);
      const title = resolveArabicPageTitle(normPath);
      if (!rec.pages[normPath]) {
        rec.pages[normPath] = {
          path: normPath,
          title,
          views: 1,
          activeSeconds: 0,
          clicks: 0,
          lastVisitAt: nowIso,
        };
      }
      rec.pages[normPath].activeSeconds += secs;
      rec.pages[normPath].lastVisitAt = nowIso;
      batchTotalSeconds += secs;
    }
  }

  if (batchTotalSeconds > 0) {
    rec.totalActiveSeconds += batchTotalSeconds;
    todayBucket.activeSeconds += batchTotalSeconds;
    rec.weekdaySeconds[weekdayStr] = (rec.weekdaySeconds[weekdayStr] || 0) + batchTotalSeconds;
  }

  // 3. Merge Hourly Seconds
  if (payload.hourlySeconds && typeof payload.hourlySeconds === "object") {
    for (const [hKey, rawSecs] of Object.entries(payload.hourlySeconds)) {
      const hNum = Number(hKey);
      if (!Number.isInteger(hNum) || hNum < 0 || hNum > 23) continue;
      const secs = Math.min(600, Math.max(0, Math.floor(Number(rawSecs) || 0)));
      if (secs > 0) {
        rec.hourlySeconds[String(hNum)] = (rec.hourlySeconds[String(hNum)] || 0) + secs;
      }
    }
  } else if (batchTotalSeconds > 0) {
    rec.hourlySeconds[hourStr] = (rec.hourlySeconds[hourStr] || 0) + batchTotalSeconds;
  }

  // 4. Merge Clicks
  if (Array.isArray(payload.clicks)) {
    for (const item of payload.clicks.slice(0, 50)) {
      const cleanLabel = String(item.label || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 70);
      if (!cleanLabel) continue;
      const normPath = normalizeTrackPath(item.path || rec.lastPath || "/");
      const pageTitle = resolveArabicPageTitle(normPath);
      const count = Math.min(200, Math.max(1, Math.floor(Number(item.count) || 1)));
      const clickKey = `${normPath}::${cleanLabel}`;

      if (!rec.topClicks[clickKey]) {
        rec.topClicks[clickKey] = {
          key: clickKey,
          label: cleanLabel,
          path: normPath,
          pageTitle,
          count: 0,
          lastClickedAt: item.ts || nowIso,
        };
      }
      rec.topClicks[clickKey].count += count;
      rec.topClicks[clickKey].lastClickedAt = item.ts || nowIso;

      if (!rec.pages[normPath]) {
        rec.pages[normPath] = {
          path: normPath,
          title: pageTitle,
          views: 1,
          activeSeconds: 0,
          clicks: 0,
          lastVisitAt: nowIso,
        };
      }
      rec.pages[normPath].clicks += count;

      rec.totalClicks += count;
      todayBucket.clicks += count;
      rec.hourlyClicks[hourStr] = (rec.hourlyClicks[hourStr] || 0) + count;
      rec.lastActionLabel = cleanLabel;
    }

    // Keep only top 60 clicked buttons per tenant to keep memory & JSON tiny
    const clickEntries = Object.values(rec.topClicks);
    if (clickEntries.length > 65) {
      clickEntries.sort((a, b) => b.count - a.count);
      const pruned: Record<string, ClickActionStat> = {};
      for (const entry of clickEntries.slice(0, 55)) {
        pruned[entry.key] = entry;
      }
      rec.topClicks = pruned;
    }
  }

  // 5. Merge Recent Events (capped at 40)
  if (Array.isArray(payload.recentEvents) && payload.recentEvents.length > 0) {
    const validEvents: RecentActivityEvent[] = [];
    for (const ev of payload.recentEvents.slice(0, 20)) {
      const label = String(ev.label || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80);
      if (!label) continue;
      const normPath = normalizeTrackPath(ev.path || "/");
      validEvents.push({
        type: ev.type === "click" ? "click" : ev.type === "session" ? "session" : "view",
        label,
        path: normPath,
        pageTitle: resolveArabicPageTitle(normPath),
        timestamp: ev.timestamp || nowIso,
      });
    }
    rec.recentEvents = [...validEvents.reverse(), ...(rec.recentEvents || [])].slice(0, 40);
  }

  // 6. Prune Daily History to last 30 days
  const dateKeys = Object.keys(rec.dailyHistory).sort();
  if (dateKeys.length > 30) {
    for (const oldKey of dateKeys.slice(0, dateKeys.length - 30)) {
      delete rec.dailyHistory[oldKey];
    }
  }

  store[tenantId] = rec;
  scheduleAnalyticsSave(false);
}

export function getTenantAnalytics(tenantId: string): TenantAnalyticsRecord {
  const store = loadAnalyticsStore(true);
  return store[tenantId] || createEmptyTenantAnalytics(tenantId);
}

export function resetTenantAnalytics(tenantId: string): TenantAnalyticsRecord {
  const store = loadAnalyticsStore(true);
  const fresh = createEmptyTenantAnalytics(tenantId);
  store[tenantId] = fresh;
  scheduleAnalyticsSave(true);
  return fresh;
}

export interface AggregatedAnalyticsSummary {
  totalTenantsTracked: number;
  activeTenantsCount: number;
  onlineNowCount: number;
  activeTodayCount: number;
  totalActiveSeconds: number;
  totalSessions: number;
  totalPageViews: number;
  totalClicks: number;
  devices: {
    desktop: number;
    mobile: number;
  };
  themes: Record<string, number>;
  hourlySeconds: Record<string, number>;
  hourlyClicks: Record<string, number>;
  weekdaySeconds: Record<string, number>;
  topPages: PageVisitStat[];
  topClicks: ClickActionStat[];
  dailyHistory: DailyUsageStat[];
  tenantsLeaderboard: Array<{
    tenantId: string;
    name: string;
    phone: string;
    domain: string | null;
    subscriptionType: string;
    isTrial: boolean;
    totalActiveSeconds: number;
    totalSessions: number;
    totalPageViews: number;
    totalClicks: number;
    activeDaysCount: number;
    topPageTitle: string;
    topClickLabel: string;
    preferredTheme: string;
    lastSeenAt: string | null;
    isOnlineNow: boolean;
    analytics: TenantAnalyticsRecord;
  }>;
}

export function getAggregatedAnalyticsSummary(
  tenantsList: StoredTenant[]
): AggregatedAnalyticsSummary {
  const store = loadAnalyticsStore(true);
  const nowMs = Date.now();
  const { dateStr: todayStr } = getCairoDateAndHour(new Date());

  let totalActiveSeconds = 0;
  let totalSessions = 0;
  let totalPageViews = 0;
  let totalClicks = 0;
  let activeTenantsCount = 0;
  let onlineNowCount = 0;
  let activeTodayCount = 0;

  const devices = { desktop: 0, mobile: 0 };
  const themes: Record<string, number> = {};
  const hourlySeconds: Record<string, number> = {};
  const hourlyClicks: Record<string, number> = {};
  const weekdaySeconds: Record<string, number> = {};
  const pagesMap = new Map<string, PageVisitStat>();
  const clicksMap = new Map<string, ClickActionStat>();
  const dailyMap = new Map<string, DailyUsageStat>();

  const tenantsLeaderboard = tenantsList.map((tenant) => {
    const rec = store[tenant.id] || createEmptyTenantAnalytics(tenant.id);
    const isTrial = Boolean(tenant.isTrial || tenant.subscriptionType === "تجربة مجانية");
    const subType = isTrial
      ? "تجربة مجانية"
      : tenant.subscriptionType === "معلم"
      ? "معلم"
      : "سنتر";

    const lastSeenMs = rec.lastSeenAt ? new Date(rec.lastSeenAt).getTime() : 0;
    const isOnlineNow = lastSeenMs > 0 && nowMs - lastSeenMs <= 2.5 * 60 * 1000;
    const isActiveToday = Boolean(
      rec.dailyHistory?.[todayStr] &&
        (rec.dailyHistory[todayStr].activeSeconds > 0 ||
          rec.dailyHistory[todayStr].views > 0 ||
          rec.dailyHistory[todayStr].clicks > 0)
    );

    if (rec.totalActiveSeconds > 0 || rec.totalPageViews > 0 || rec.totalClicks > 0) {
      activeTenantsCount += 1;
      const themeKey = rec.preferredTheme || "default";
      themes[themeKey] = (themes[themeKey] || 0) + 1;
    }
    if (isOnlineNow) onlineNowCount += 1;
    if (isActiveToday) activeTodayCount += 1;

    totalActiveSeconds += rec.totalActiveSeconds || 0;
    totalSessions += rec.totalSessions || 0;
    totalPageViews += rec.totalPageViews || 0;
    totalClicks += rec.totalClicks || 0;
    devices.desktop += rec.devices?.desktop || 0;
    devices.mobile += rec.devices?.mobile || 0;

    for (const [h, s] of Object.entries(rec.hourlySeconds || {})) {
      hourlySeconds[h] = (hourlySeconds[h] || 0) + (Number(s) || 0);
    }
    for (const [h, c] of Object.entries(rec.hourlyClicks || {})) {
      hourlyClicks[h] = (hourlyClicks[h] || 0) + (Number(c) || 0);
    }
    for (const [w, s] of Object.entries(rec.weekdaySeconds || {})) {
      weekdaySeconds[w] = (weekdaySeconds[w] || 0) + (Number(s) || 0);
    }

    const tenantPages = Object.values(rec.pages || {});
    for (const p of tenantPages) {
      const existing = pagesMap.get(p.path);
      if (!existing) {
        pagesMap.set(p.path, { ...p });
      } else {
        existing.views += p.views || 0;
        existing.activeSeconds += p.activeSeconds || 0;
        existing.clicks += p.clicks || 0;
        if (p.lastVisitAt > existing.lastVisitAt) {
          existing.lastVisitAt = p.lastVisitAt;
        }
      }
    }

    const tenantClicks = Object.values(rec.topClicks || {});
    for (const c of tenantClicks) {
      const existing = clicksMap.get(c.key);
      if (!existing) {
        clicksMap.set(c.key, { ...c });
      } else {
        existing.count += c.count || 0;
        if (c.lastClickedAt > existing.lastClickedAt) {
          existing.lastClickedAt = c.lastClickedAt;
        }
      }
    }

    for (const d of Object.values(rec.dailyHistory || {})) {
      const existing = dailyMap.get(d.date);
      if (!existing) {
        dailyMap.set(d.date, { ...d });
      } else {
        existing.activeSeconds += d.activeSeconds || 0;
        existing.views += d.views || 0;
        existing.clicks += d.clicks || 0;
        existing.sessions += d.sessions || 0;
      }
    }

    const sortedPages = [...tenantPages].sort(
      (a, b) => b.activeSeconds - a.activeSeconds || b.views - a.views
    );
    const sortedClicks = [...tenantClicks].sort((a, b) => b.count - a.count);

    return {
      tenantId: tenant.id,
      name: tenant.name || "عميل بدون اسم",
      phone: tenant.phone,
      domain: tenant.domain || null,
      subscriptionType: subType,
      isTrial,
      totalActiveSeconds: rec.totalActiveSeconds || 0,
      totalSessions: rec.totalSessions || 0,
      totalPageViews: rec.totalPageViews || 0,
      totalClicks: rec.totalClicks || 0,
      activeDaysCount: Object.keys(rec.dailyHistory || {}).length,
      topPageTitle: sortedPages[0]?.title || "لم يبدأ بعد",
      topClickLabel: sortedClicks[0]?.label || "—",
      preferredTheme: rec.preferredTheme || "default",
      lastSeenAt: rec.lastSeenAt || null,
      isOnlineNow,
      analytics: rec,
    };
  });

  tenantsLeaderboard.sort(
    (a, b) =>
      b.totalActiveSeconds - a.totalActiveSeconds ||
      b.totalClicks - a.totalClicks ||
      b.totalPageViews - a.totalPageViews
  );

  const topPages = Array.from(pagesMap.values()).sort(
    (a, b) => b.activeSeconds - a.activeSeconds || b.views - a.views
  );

  const topClicks = Array.from(clicksMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 40);

  const dailyHistory = Array.from(dailyMap.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14);

  return {
    totalTenantsTracked: tenantsList.length,
    activeTenantsCount,
    onlineNowCount,
    activeTodayCount,
    totalActiveSeconds,
    totalSessions,
    totalPageViews,
    totalClicks,
    devices,
    themes,
    hourlySeconds,
    hourlyClicks,
    weekdaySeconds,
    topPages,
    topClicks,
    dailyHistory,
    tenantsLeaderboard,
  };
}

