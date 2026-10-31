"use client";

import React, { useState } from "react";
import Link from "next/link";
import { getAggregatedAnalyticsAction } from "@/app/actions/admin-analytics";
import type { AggregatedAnalyticsSummary } from "@/lib/analytics-repository";
import TenantAnalyticsPanel, {
  formatDurationArabic,
  formatRelativeTimeArabic,
  THEME_ARABIC_NAMES,
  WEEKDAY_NAMES_AR,
  WEEKDAY_ORDER,
  formatHourLabelAr,
} from "./TenantAnalyticsPanel";
import {
  Activity,
  ArrowRight,
  Clock,
  MousePointerClick,
  Eye,
  Users,
  Layers,
  Calendar,
  Flame,
  Monitor,
  Smartphone,
  Palette,
  RefreshCw,
  Search,
  ExternalLink,
  X,
  BarChart3,
  Sparkles,
} from "lucide-react";

interface AdminAnalyticsClientProps {
  initialSummary: AggregatedAnalyticsSummary;
}

export default function AdminAnalyticsClient({
  initialSummary,
}: AdminAnalyticsClientProps) {
  const [summary, setSummary] = useState<AggregatedAnalyticsSummary>(initialSummary);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await getAggregatedAnalyticsAction();
      if (res.success && res.data) {
        setSummary(res.data);
      }
    } finally {
      setRefreshing(false);
    }
  };

  const getPeriodSeconds = (hours: number[]) =>
    hours.reduce((acc, h) => acc + (Number(summary.hourlySeconds?.[String(h)]) || 0), 0);

  const periods = [
    {
      label: "صباحاً (6 ص - 12 م)",
      secs: getPeriodSeconds([6, 7, 8, 9, 10, 11]),
      color: "bg-amber-500",
    },
    {
      label: "ظهراً وعصراً (12 م - 6 م)",
      secs: getPeriodSeconds([12, 13, 14, 15, 16, 17]),
      color: "bg-blue-600",
    },
    {
      label: "مساءً (6 م - 12 ص)",
      secs: getPeriodSeconds([18, 19, 20, 21, 22, 23]),
      color: "bg-indigo-600",
    },
    {
      label: "ليلاً وفجراً (12 ص - 6 ص)",
      secs: getPeriodSeconds([0, 1, 2, 3, 4, 5]),
      color: "bg-purple-600",
    },
  ];
  const maxPeriodSecs = Math.max(1, ...periods.map((p) => p.secs));

  let peakHour = -1;
  let peakHourSec = 0;
  for (let h = 0; h < 24; h++) {
    const val = Number(summary.hourlySeconds?.[String(h)]) || 0;
    if (val > peakHourSec) {
      peakHourSec = val;
      peakHour = h;
    }
  }
  const maxHourlySec = Math.max(1, peakHourSec);

  const maxPageSec = Math.max(
    1,
    ...(summary.topPages || []).map((p) => p.activeSeconds || 1)
  );
  const maxClickCount = Math.max(
    1,
    ...(summary.topClicks || []).map((c) => c.count || 1)
  );

  const filteredLeaderboard = (summary.tenantsLeaderboard || []).filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      t.phone.includes(q) ||
      (t.domain || "").toLowerCase().includes(q)
    );
  });

  const selectedTenantEntry = selectedTenantId
    ? summary.tenantsLeaderboard.find((t) => t.tenantId === selectedTenantId) || null
    : null;

  return (
    <div className="flex-1 h-full w-full overflow-y-auto bg-[#F4F6FA] text-slate-800 pb-24" dir="rtl">
      {/* Sticky Top Header */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-20 shadow-2xs">
        <div className="w-full px-6 lg:px-10 xl:px-12 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 bg-gradient-to-tr from-indigo-600 to-blue-600 text-white rounded-2xl flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black text-slate-900">
                  مركز تحليلات وتتبع سلوك جميع العملاء (Global Analytics)
                </h1>
                <span className="text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{summary.onlineNowCount} متصل الآن</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                إحصائيات مجمعة شاملة عن طريقة استخدام العملاء للبرنامج، أكثر الأزرار ضغطاً، الأقسام الأكثر زيارة، ومواعيد الذروة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 text-xs font-extrabold transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span>{refreshing ? "جاري التحديث..." : "تحديث البيانات الحية"}</span>
            </button>

            <Link
              href="/admin"
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold transition-all shadow-xs"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>العودة لإدارة المشتركين</span>
            </Link>
          </div>
        </div>
      </header>

      <div className="w-full px-6 lg:px-10 xl:px-12 py-6 space-y-6">
        {/* Global KPI Cards (4 Columns) */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-slate-400">إجمالي وقت فتح واستخدام المنصة</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">
                {formatDurationArabic(summary.totalActiveSeconds)}
              </h3>
              <p className="text-[11px] font-bold text-blue-600 mt-1">
                عبر {summary.totalSessions} جلسة استخدام فعلية
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
              <Clock className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-slate-400">إجمالي النقرات وتفاعلات الأزرار</p>
              <h3 className="text-2xl font-black text-emerald-600 mt-1 font-mono">
                {summary.totalClicks} ضغطة
              </h3>
              <p className="text-[11px] font-bold text-slate-500 mt-1 truncate max-w-[190px]">
                الأكثر: {summary.topClicks[0]?.label || "—"}
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
              <MousePointerClick className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-slate-400">إجمالي تصفح الأقسام والصفحات</p>
              <h3 className="text-2xl font-black text-purple-600 mt-1 font-mono">
                {summary.totalPageViews} زيارة
              </h3>
              <p className="text-[11px] font-bold text-slate-500 mt-1 truncate max-w-[190px]">
                الأول: {summary.topPages[0]?.title || "—"}
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center shrink-0">
              <Eye className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-slate-400">العملاء النشطون وموعد الذروة</p>
              <h3 className="text-2xl font-black text-amber-600 mt-1">
                {summary.activeTenantsCount} / {summary.totalTenantsTracked} عميل
              </h3>
              <p className="text-[11px] font-bold text-amber-800 mt-1">
                نشط اليوم: {summary.activeTodayCount} • الذروة:{" "}
                {peakHour >= 0 ? formatHourLabelAr(peakHour) : "—"}
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0">
              <Flame className="w-6 h-6" />
            </div>
          </div>
        </section>

        {/* Row 2: Aggregated Sections Usage + Aggregated Top Clicked Buttons */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Most Used Sections Across All Clients */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-blue-600" />
                  <span>ترتيب أقسام التطبيق الأكثر استخداماً (مجمعة لكل العملاء)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  معرفة أي أجزاء البرنامج يقضي فيها العملاء أكبر وقت وأعلى عدد زيارات ونقرات
                </p>
              </div>
            </div>

            {summary.topPages.length === 0 ? (
              <p className="text-xs text-slate-400 py-10 text-center">
                لم يتم تسجيل زيارات لأقسام التطبيق بعد.
              </p>
            ) : (
              <div className="space-y-3">
                {summary.topPages.map((pg, idx) => {
                  const widthPct = Math.max(
                    6,
                    Math.round(((pg.activeSeconds || 1) / maxPageSec) * 100)
                  );
                  return (
                    <div
                      key={pg.path}
                      className="p-3 rounded-2xl bg-slate-50/70 border border-slate-100 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-6 h-6 rounded-lg bg-blue-600 text-white font-black text-[11px] flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <span className="font-black text-slate-900 truncate">{pg.title}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-bold shrink-0">
                          <span className="bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-lg">
                            {formatDurationArabic(pg.activeSeconds)}
                          </span>
                          <span className="bg-white border border-slate-200 text-slate-700 px-2 py-0.5 rounded-lg font-mono">
                            {pg.views} زيارة
                          </span>
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/70 px-2 py-0.5 rounded-lg font-mono">
                            {pg.clicks} ضغطة
                          </span>
                        </div>
                      </div>
                      <div className="w-full h-2 bg-slate-200/70 rounded-full overflow-hidden">
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

          {/* Top Clicked Buttons Across All Clients */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                  <MousePointerClick className="w-5 h-5 text-emerald-600" />
                  <span>بيدوسوا فين أكتر؟ (الأزرار والخواص الأعلى ضغطاً)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  أكثر الأزرار والأدوات التي يتفاعل معها العملاء داخل جميع نسخ التطبيق
                </p>
              </div>
            </div>

            {summary.topClicks.length === 0 ? (
              <p className="text-xs text-slate-400 py-10 text-center">
                لم يتم تسجيل نقرات على أزرار التطبيق بعد.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {summary.topClicks.slice(0, 15).map((clk, idx) => {
                  const widthPct = Math.max(8, Math.round((clk.count / maxClickCount) * 100));
                  return (
                    <div
                      key={clk.key}
                      className="p-3 rounded-2xl bg-slate-50/70 border border-slate-100 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white font-black text-[11px] flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <span className="font-black text-slate-900 truncate">{clk.label}</span>
                          <span className="text-[11px] font-bold text-slate-400 truncate">
                            ({clk.pageTitle})
                          </span>
                        </div>
                        <span className="text-xs font-black font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-lg shrink-0">
                          {clk.count} ضغطة
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
        </section>

        {/* Row 3: Peak Usage Hours & Days of Week */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Hourly & Period Usage */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-600" />
                <span>مواعيد وأوقات فتح العملاء للتطبيق على مدار الـ 24 ساعة</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                يوضح الفترات الزمنية وساعات الذروة التي يتواجد فيها العملاء داخل المنصة
              </p>
            </div>

            <div className="space-y-2.5">
              {periods.map((p) => {
                const pct =
                  p.secs > 0 ? Math.max(6, Math.round((p.secs / maxPeriodSecs) * 100)) : 0;
                return (
                  <div key={p.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-700">{p.label}</span>
                      <span className="text-slate-900 font-black">
                        {formatDurationArabic(p.secs)}
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${p.color}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-slate-100">
              <span className="text-xs font-extrabold text-slate-600 block mb-2">
                التوزيع التفصيلي بالساعة (من 12 صباحاً حتى 11 مساءً):
              </span>
              <div className="grid grid-cols-12 gap-1.5 items-end h-20 pt-2">
                {Array.from({ length: 12 }, (_, i) => i * 2).map((h) => {
                  const secPair =
                    (Number(summary.hourlySeconds?.[String(h)]) || 0) +
                    (Number(summary.hourlySeconds?.[String(h + 1)]) || 0);
                  const hPct =
                    secPair > 0
                      ? Math.max(
                          14,
                          Math.min(100, Math.round((secPair / (maxHourlySec * 1.5)) * 100))
                        )
                      : 6;
                  return (
                    <div
                      key={h}
                      className="flex flex-col items-center gap-1 h-full justify-end"
                      title={`${formatHourLabelAr(h)} - ${formatHourLabelAr(h + 2)}: ${formatDurationArabic(secPair)}`}
                    >
                      <div
                        className={`w-full rounded-t-md transition-all ${
                          secPair > 0 ? "bg-indigo-600" : "bg-slate-200"
                        }`}
                        style={{ height: `${hPct}%` }}
                      />
                      <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap">
                        {formatHourLabelAr(h)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Weekdays, Devices & Preferred Themes */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-2xs space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-purple-600" />
                <span>أيام الأسبوع الأكثر استخداماً والأجهزة والثيمات المفضلة</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                توزيع استخدام المنصة على أيام الأسبوع ونوع الأجهزة والثيمات التي يفضلها المعلمون
              </p>
            </div>

            <div className="grid grid-cols-7 gap-2 text-center">
              {WEEKDAY_ORDER.map((wKey) => {
                const wSec = Number(summary.weekdaySeconds?.[wKey]) || 0;
                const isUsed = wSec > 0;
                return (
                  <div
                    key={wKey}
                    className={`p-2.5 rounded-2xl border ${
                      isUsed
                        ? "bg-purple-50 border-purple-200 text-purple-900"
                        : "bg-slate-50 border-slate-100 text-slate-400"
                    }`}
                  >
                    <span className="block text-xs font-black">{WEEKDAY_NAMES_AR[wKey]}</span>
                    <span className="block text-[10px] font-bold mt-1">
                      {isUsed ? formatDurationArabic(wSec) : "—"}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-2">
                <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <Monitor className="w-4 h-4 text-blue-600" />
                  <span>نوع أجهزة الاستخدام</span>
                </span>
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-600">كمبيوتر / لابتوب:</span>
                  <span className="font-mono font-black text-blue-700">
                    {summary.devices.desktop} جلسة
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-600">موبايل / تابلت:</span>
                  <span className="font-mono font-black text-emerald-700">
                    {summary.devices.mobile} جلسة
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-2">
                <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <Palette className="w-4 h-4 text-purple-600" />
                  <span>الثيمات الأكثر اختياراً</span>
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {Object.keys(summary.themes).length === 0 ? (
                    <span className="text-[11px] text-slate-400">الأزرق الملكي (الافتراضي)</span>
                  ) : (
                    Object.entries(summary.themes).map(([th, cnt]) => (
                      <span
                        key={th}
                        className="text-[11px] font-extrabold bg-white border border-slate-200 text-slate-700 px-2.5 py-1 rounded-xl"
                      >
                        {THEME_ARABIC_NAMES[th] || th} ({cnt})
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Row 4: Per-Client Usage Leaderboard & Drilldown */}
        <section className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                <span>جدول تتبع استخدام العملاء التفصيلي ({filteredLeaderboard.length} عميل)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                اضغط على &quot;عرض تفاصيل التتبع&quot; لأي عميل لاستعراض خريطة ضغطاته وأوقاته وسجل تحركاته بالكامل
              </p>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث باسم العميل أو الهاتف..."
                className="w-full pr-10 pl-3.5 h-10 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-600"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200/80 text-xs font-extrabold text-slate-500 whitespace-nowrap">
                  <th className="py-3.5 px-6">العميل والباقة</th>
                  <th className="py-3.5 px-5">حالة التواجد وآخر ظهور</th>
                  <th className="py-3.5 px-5">إجمالي وقت الفتح</th>
                  <th className="py-3.5 px-5">الجلسات والزيارات</th>
                  <th className="py-3.5 px-5">إجمالي النقرات</th>
                  <th className="py-3.5 px-5">القسم والزر الأكثر استخداماً</th>
                  <th className="py-3.5 px-6 text-left">التفاصيل الكاملة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                {filteredLeaderboard.map((item) => {
                  const seen = formatRelativeTimeArabic(item.lastSeenAt);
                  return (
                    <tr key={item.tenantId} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-4 px-6 whitespace-nowrap">
                        <div className="font-black text-slate-900">{item.name}</div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                          <span className="font-mono" dir="ltr">
                            {item.phone}
                          </span>
                          <span>•</span>
                          <span className="font-bold text-blue-600">
                            {item.isTrial ? "النسخة المجانية (24س)" : item.subscriptionType}
                          </span>
                        </div>
                      </td>

                      <td className="py-4 px-5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold ${
                            seen.isOnline
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              seen.isOnline ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                            }`}
                          />
                          <span>{seen.text}</span>
                        </span>
                      </td>

                      <td className="py-4 px-5 whitespace-nowrap">
                        <span className="font-black text-blue-700 bg-blue-50 border border-blue-200/60 px-2.5 py-1 rounded-xl text-xs">
                          {formatDurationArabic(item.totalActiveSeconds)}
                        </span>
                      </td>

                      <td className="py-4 px-5 whitespace-nowrap font-mono text-xs font-bold text-slate-700">
                        {item.totalSessions} جلسة • {item.totalPageViews} زيارة
                      </td>

                      <td className="py-4 px-5 whitespace-nowrap">
                        <span className="font-mono font-black text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2.5 py-1 rounded-xl text-xs">
                          {item.totalClicks} ضغطة
                        </span>
                      </td>

                      <td className="py-4 px-5 max-w-[240px]">
                        <div className="text-xs font-extrabold text-slate-800 truncate">
                          القسم: {item.topPageTitle}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate mt-0.5">
                          الزر: {item.topClickLabel}
                        </div>
                      </td>

                      <td className="py-4 px-6 text-left whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedTenantId(item.tenantId)}
                          className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold px-3.5 py-2 rounded-xl shadow-xs transition-all cursor-pointer"
                        >
                          <Activity className="w-3.5 h-3.5" />
                          <span>عرض تفاصيل التتبع</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Modal Drilldown for Selected Tenant */}
      {selectedTenantEntry && (
        <div
          className="fixed inset-0 z-[9999] bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          dir="rtl"
        >
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    التتبع التفصيلي للعميل: {selectedTenantEntry.name}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono" dir="ltr">
                    {selectedTenantEntry.phone}{" "}
                    {selectedTenantEntry.domain ? `• ${selectedTenantEntry.domain}` : ""}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTenantId(null)}
                className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-300 text-slate-700 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <TenantAnalyticsPanel
                tenantId={selectedTenantEntry.tenantId}
                tenantName={selectedTenantEntry.name}
                initialData={selectedTenantEntry.analytics}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

