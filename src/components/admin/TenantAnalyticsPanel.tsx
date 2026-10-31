"use client";

import React, { useEffect, useState } from "react";
import {
  getTenantAnalyticsAction,
  resetTenantAnalyticsAction,
} from "@/app/actions/admin-analytics";
import type { TenantAnalyticsRecord } from "@/lib/analytics-repository";
import {
  Activity,
  Clock,
  MousePointerClick,
  Eye,
  Calendar,
  Monitor,
  Smartphone,
  Palette,
  RefreshCw,
  RotateCcw,
  Loader2,
  Sparkles,
  Layers,
  History,
  Flame,
} from "lucide-react";

export function formatDurationArabic(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  if (sec === 0) return "0 ثانية";
  const hours = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const remSec = sec % 60;

  if (hours > 0) {
    return mins > 0 ? `${hours} س و ${mins} د` : `${hours} ساعة`;
  }
  if (mins > 0) {
    return remSec > 0 ? `${mins} د و ${remSec} ث` : `${mins} دقيقة`;
  }
  return `${remSec} ثانية`;
}

export function formatRelativeTimeArabic(iso: string | null): {
  text: string;
  isOnline: boolean;
} {
  if (!iso) return { text: "لم يفتح التطبيق بعد", isOnline: false };
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return { text: "غير معروف", isOnline: false };
  const diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (diffSec <= 150) {
    return { text: "متصل الآن (نشط)", isOnline: true };
  }
  if (diffSec < 3600) {
    return { text: `منذ ${Math.floor(diffSec / 60)} دقيقة`, isOnline: false };
  }
  if (diffSec < 86400) {
    return { text: `منذ ${Math.floor(diffSec / 3600)} ساعة`, isOnline: false };
  }
  const days = Math.floor(diffSec / 86400);
  return { text: `منذ ${days} يوم`, isOnline: false };
}

export const THEME_ARABIC_NAMES: Record<string, string> = {
  default: "الأزرق الملكي (الافتراضي)",
  orange: "البرتقالي الدافئ",
  burgundy: "أحمر برجاندي",
  emerald: "الأخضر الزمردي",
  violet: "البنفسجي الملكي",
  dark: "الوضع الليلي (Dark)",
};

export const WEEKDAY_NAMES_AR: Record<string, string> = {
  "6": "السبت",
  "0": "الأحد",
  "1": "الاثنين",
  "2": "الثلاثاء",
  "3": "الأربعاء",
  "4": "الخميس",
  "5": "الجمعة",
};

export const WEEKDAY_ORDER = ["6", "0", "1", "2", "3", "4", "5"];

export function formatHourLabelAr(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  if (h === 0) return "12 ص";
  if (h < 12) return `${h} ص`;
  if (h === 12) return "12 م";
  return `${h - 12} م`;
}

interface TenantAnalyticsPanelProps {
  tenantId: string;
  tenantName?: string | null;
  initialData?: TenantAnalyticsRecord | null;
}

export default function TenantAnalyticsPanel({
  tenantId,
  tenantName,
  initialData = null,
}: TenantAnalyticsPanelProps) {
  const [data, setData] = useState<TenantAnalyticsRecord | null>(initialData);
  const [loading, setLoading] = useState<boolean>(!initialData);
  const [resetting, setResetting] = useState<boolean>(false);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const res = await getTenantAnalyticsAction(tenantId);
      if (res.success && res.data) {
        setData(res.data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initialData) {
      loadAnalytics();
    } else {
      setData(initialData);
    }
  }, [tenantId, initialData]);

  const handleReset = async () => {
    if (!confirm(`هل أنت متأكد من تصفير سجل التتبع والإحصائيات الخاصة بالعميل (${tenantName || tenantId})؟`)) {
      return;
    }
    setResetting(true);
    try {
      const res = await resetTenantAnalyticsAction(tenantId);
      if (res.success && res.data) {
        setData(res.data);
      }
    } finally {
      setResetting(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="py-14 flex flex-col items-center justify-center gap-3 text-slate-500">
        <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
        <p className="text-xs font-bold">جاري تحميل بيانات تتبع وسلوك العميل...</p>
      </div>
    );
  }

  const rec = data;
  if (!rec) {
    return (
      <div className="p-8 text-center text-xs font-bold text-slate-500">
        لا توجد بيانات تتبع متاحة حالياً.
      </div>
    );
  }

  const lastSeenInfo = formatRelativeTimeArabic(rec.lastSeenAt);
  const pagesList = Object.values(rec.pages || {}).sort(
    (a, b) => b.activeSeconds - a.activeSeconds || b.views - a.views
  );
  const maxPageSec = Math.max(1, ...pagesList.map((p) => p.activeSeconds || 1));

  const clicksList = Object.values(rec.topClicks || {}).sort((a, b) => b.count - a.count);
  const maxClickCount = Math.max(1, ...clicksList.map((c) => c.count || 1));

  const activeDaysCount = Object.keys(rec.dailyHistory || {}).length;

  // Compute time-of-day periods (Morning 6-11, Afternoon 12-17, Evening 18-23, Night 0-5)
  const getPeriodSeconds = (hours: number[]) =>
    hours.reduce((acc, h) => acc + (Number(rec.hourlySeconds?.[String(h)]) || 0), 0);

  const periods = [
    { label: "صباحاً (6 ص - 12 م)", secs: getPeriodSeconds([6, 7, 8, 9, 10, 11]), color: "bg-amber-500" },
    { label: "ظهراً وعصراً (12 م - 6 م)", secs: getPeriodSeconds([12, 13, 14, 15, 16, 17]), color: "bg-blue-600" },
    { label: "مساءً (6 م - 12 ص)", secs: getPeriodSeconds([18, 19, 20, 21, 22, 23]), color: "bg-indigo-600" },
    { label: "ليلاً وفجراً (12 ص - 6 ص)", secs: getPeriodSeconds([0, 1, 2, 3, 4, 5]), color: "bg-purple-600" },
  ];
  const maxPeriodSecs = Math.max(1, ...periods.map((p) => p.secs));

  // Peak hour
  let peakHour = -1;
  let peakHourSec = 0;
  for (let h = 0; h < 24; h++) {
    const val = Number(rec.hourlySeconds?.[String(h)]) || 0;
    if (val > peakHourSec) {
      peakHourSec = val;
      peakHour = h;
    }
  }
  const maxHourlySec = Math.max(1, peakHourSec);

  const maxWeekdaySec = Math.max(
    1,
    ...WEEKDAY_ORDER.map((k) => Number(rec.weekdaySeconds?.[k]) || 0)
  );

  return (
    <div className="space-y-5" dir="rtl">
      {/* Top Action & Live Status Bar */}
      <div className="p-4 bg-gradient-to-l from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-xs sm:text-sm font-black text-white">
                تقرير تتبع الاستخدام والسلوك: {tenantName || rec.tenantName || "العميل"}
              </h4>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  lastSeenInfo.isOnline
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30"
                    : "bg-white/10 text-slate-300 border border-white/15"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    lastSeenInfo.isOnline ? "bg-emerald-400 animate-pulse" : "bg-slate-400"
                  }`}
                />
                <span>{lastSeenInfo.text}</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5">
              {rec.lastPageTitle
                ? `آخر تواجد: ${rec.lastPageTitle}${rec.lastActionLabel ? ` • آخر ضغطة: "${rec.lastActionLabel}"` : ""}`
                : "يتم تسجيل النقرات، الصفحات، وأوقات فتح التطبيق تلقائياً في الخلفية بدون أي حمل"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadAnalytics}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-white/10 hover:bg-white/20 text-white border border-white/15 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>تحديث الآن</span>
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={resetting}
            className="inline-flex items-center gap-1 text-[11px] font-bold bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-400/30 px-2.5 py-1.5 rounded-xl transition-all cursor-pointer"
            title="تصفير سجل التتبع لهذا العميل"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>تصفير التتبع</span>
          </button>
        </div>
      </div>

      {/* 4 Core KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-3.5 space-y-1">
          <div className="flex items-center justify-between text-blue-600">
            <span className="text-[11px] font-bold text-slate-600">إجمالي وقت الفتح الفعلي</span>
            <Clock className="w-4 h-4 shrink-0" />
          </div>
          <p className="text-base sm:text-lg font-black text-slate-900">
            {formatDurationArabic(rec.totalActiveSeconds)}
          </p>
          <span className="text-[10px] font-bold text-blue-700 block">
            على مدار {activeDaysCount || 0} يوم نشاط
          </span>
        </div>

        <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-3.5 space-y-1">
          <div className="flex items-center justify-between text-emerald-600">
            <span className="text-[11px] font-bold text-slate-600">إجمالي النقرات والأزرار</span>
            <MousePointerClick className="w-4 h-4 shrink-0" />
          </div>
          <p className="text-base sm:text-lg font-black text-slate-900 font-mono">
            {rec.totalClicks} ضغطة
          </p>
          <span className="text-[10px] font-bold text-emerald-700 block truncate">
            الأكثر: {clicksList[0]?.label || "—"}
          </span>
        </div>

        <div className="bg-purple-50/70 border border-purple-200/80 rounded-2xl p-3.5 space-y-1">
          <div className="flex items-center justify-between text-purple-600">
            <span className="text-[11px] font-bold text-slate-600">الزيارات والجلسات</span>
            <Eye className="w-4 h-4 shrink-0" />
          </div>
          <p className="text-base sm:text-lg font-black text-slate-900 font-mono">
            {rec.totalPageViews} صفحة
          </p>
          <span className="text-[10px] font-bold text-purple-700 block">
            في {rec.totalSessions} جلسة استخدام
          </span>
        </div>

        <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3.5 space-y-1">
          <div className="flex items-center justify-between text-amber-600">
            <span className="text-[11px] font-bold text-slate-600">موعد الذروة والجهاز</span>
            <Flame className="w-4 h-4 shrink-0" />
          </div>
          <p className="text-sm sm:text-base font-black text-slate-900">
            {peakHour >= 0 ? `الساعة ${formatHourLabelAr(peakHour)}` : "لم يحدد بعد"}
          </p>
          <span className="text-[10px] font-bold text-amber-800 flex items-center gap-1 truncate">
            {(rec.devices?.mobile || 0) > (rec.devices?.desktop || 0) ? (
              <>
                <Smartphone className="w-3 h-3 shrink-0" />
                <span>موبايل • {THEME_ARABIC_NAMES[rec.preferredTheme] || "الأزرق"}</span>
              </>
            ) : (
              <>
                <Monitor className="w-3 h-3 shrink-0" />
                <span>كمبيوتر • {THEME_ARABIC_NAMES[rec.preferredTheme] || "الأزرق"}</span>
              </>
            )}
          </span>
        </div>
      </div>

      {/* Row 2: Most Used App Sections + Top Clicked Buttons */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 1. Sections / Pages Usage */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h5 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>الأقسام الأكثر استخداماً ووقت البقاء فيها</span>
            </h5>
            <span className="text-[10px] font-bold text-slate-400">
              {pagesList.length} قسم مستخدم
            </span>
          </div>

          {pagesList.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">
              لم يقم العميل بزيارة أي قسم بعد.
            </p>
          ) : (
            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {pagesList.map((pg) => {
                const widthPct = Math.max(
                  6,
                  Math.round(((pg.activeSeconds || 1) / maxPageSec) * 100)
                );
                return (
                  <div key={pg.path} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-extrabold text-slate-800 truncate">{pg.title}</span>
                      <div className="flex items-center gap-2 text-[11px] font-bold shrink-0">
                        <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                          {formatDurationArabic(pg.activeSeconds)}
                        </span>
                        <span className="text-slate-500 font-mono">{pg.views} زيارة</span>
                        <span className="text-emerald-700 font-mono">{pg.clicks} ضغطة</span>
                      </div>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full transition-all"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 2. Top Clicked Buttons ("بيدوسوا فين أكتر") */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h5 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
              <MousePointerClick className="w-4 h-4 text-emerald-600" />
              <span>أكثر الأزرار والأدوات التي يضغط عليها العميل</span>
            </h5>
            <span className="text-[10px] font-bold text-slate-400">
              أعلى {Math.min(12, clicksList.length)} تفاعل
            </span>
          </div>

          {clicksList.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">
              لم يتم تسجيل نقرات على أزرار بعد.
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {clicksList.slice(0, 12).map((clk, idx) => {
                const widthPct = Math.max(8, Math.round((clk.count / maxClickCount) * 100));
                return (
                  <div
                    key={clk.key}
                    className="p-2 rounded-xl bg-slate-50/80 border border-slate-100 space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-black flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="font-extrabold text-slate-900 truncate">{clk.label}</span>
                        <span className="text-[10px] font-bold text-slate-400 truncate">
                          ({clk.pageTitle})
                        </span>
                      </div>
                      <span className="text-xs font-black font-mono text-emerald-700 bg-emerald-50 border border-emerald-200/70 px-2 py-0.5 rounded-lg shrink-0">
                        {clk.count} مرة
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200/70 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Usage Times (مواعيد الاستخدام بالساعات وأيام الأسبوع) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Time of Day & 24h Distribution */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h5 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-600" />
              <span>مواعيد فتح التطبيق على مدار اليوم (بتوقيت مصر)</span>
            </h5>
          </div>

          <div className="space-y-2">
            {periods.map((p) => {
              const pct = p.secs > 0 ? Math.max(6, Math.round((p.secs / maxPeriodSecs) * 100)) : 0;
              return (
                <div key={p.label} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="text-slate-700">{p.label}</span>
                    <span className="text-slate-900 font-extrabold">
                      {formatDurationArabic(p.secs)}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${p.color}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* 24-Hour Mini Bar Strip */}
          <div className="pt-2 border-t border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 block mb-2">
              التفصيل بالساعة (من 12 ص حتى 11 م):
            </span>
            <div className="grid grid-cols-12 gap-1 items-end h-16 pt-2">
              {Array.from({ length: 12 }, (_, i) => i * 2).map((h) => {
                const secPair =
                  (Number(rec.hourlySeconds?.[String(h)]) || 0) +
                  (Number(rec.hourlySeconds?.[String(h + 1)]) || 0);
                const hPct =
                  secPair > 0 ? Math.max(14, Math.min(100, Math.round((secPair / (maxHourlySec * 1.5)) * 100))) : 6;
                return (
                  <div
                    key={h}
                    className="flex flex-col items-center gap-1 h-full justify-end"
                    title={`${formatHourLabelAr(h)} - ${formatHourLabelAr(h + 2)}: ${formatDurationArabic(secPair)}`}
                  >
                    <div
                      className={`w-full rounded-t-md transition-all ${
                        secPair > 0 ? "bg-blue-600" : "bg-slate-200"
                      }`}
                      style={{ height: `${hPct}%` }}
                    />
                    <span className="text-[9px] font-bold text-slate-500 whitespace-nowrap">
                      {formatHourLabelAr(h)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Days of Week & Recent Activity Stream */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h5 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-purple-600" />
              <span>أيام الأسبوع الأكثر نشاطاً + آخر التحركات</span>
            </h5>
          </div>

          {/* 7 Days Strip */}
          <div className="grid grid-cols-7 gap-1.5 text-center">
            {WEEKDAY_ORDER.map((wKey) => {
              const wSec = Number(rec.weekdaySeconds?.[wKey]) || 0;
              const isUsed = wSec > 0;
              return (
                <div
                  key={wKey}
                  className={`p-2 rounded-xl border ${
                    isUsed
                      ? "bg-purple-50/80 border-purple-200 text-purple-900"
                      : "bg-slate-50 border-slate-100 text-slate-400"
                  }`}
                >
                  <span className="block text-[10px] font-black">{WEEKDAY_NAMES_AR[wKey]}</span>
                  <span className="block text-[9px] font-bold mt-0.5">
                    {isUsed ? formatDurationArabic(wSec) : "—"}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Recent Events Feed */}
          <div className="pt-2 border-t border-slate-100 space-y-1.5">
            <span className="text-[10px] font-extrabold text-slate-500 flex items-center gap-1">
              <History className="w-3.5 h-3.5 text-blue-600" />
              <span>آخر التحركات والنقرات المسجلة:</span>
            </span>
            {(!rec.recentEvents || rec.recentEvents.length === 0) ? (
              <p className="text-[11px] text-slate-400 py-2">لا توجد تحركات مسجلة بعد.</p>
            ) : (
              <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                {rec.recentEvents.slice(0, 12).map((ev, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-2 text-[11px] bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          ev.type === "click"
                            ? "bg-emerald-500"
                            : ev.type === "session"
                            ? "bg-amber-500"
                            : "bg-blue-500"
                        }`}
                      />
                      <span className="font-bold text-slate-800 truncate">{ev.label}</span>
                      <span className="text-[10px] text-slate-400 shrink-0">({ev.pageTitle})</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 shrink-0" dir="ltr">
                      {new Date(ev.timestamp).toLocaleTimeString("ar-EG", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

