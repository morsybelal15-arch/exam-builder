import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { logoutAction } from "@/app/actions/auth";
import CreateTenantModal from "@/components/admin/CreateTenantModal";
import TenantListView from "@/components/admin/TenantListView";
import AutoUpdateButton from "@/components/admin/AutoUpdateButton";
import VpsDeployButton from "@/components/admin/VpsDeployButton";
import { HOSTINGER_VPS_CONFIG, DEFAULT_MAIN_APP_URL } from "@/lib/vps-service";
import { getTenantsList, getTenantCounts } from "@/lib/tenants-repository";
import { getLatestCommitInfo } from "@/app/actions/auto-update";
import { isDatabaseReachable } from "@/lib/prisma";
import { tenantEnabled } from "@/lib/app-mode";
import { formatUsedStorageShortArabic } from "@/lib/storage-format";
import {
  Users,
  CheckCircle2,
  HardDrive,
  ShieldCheck,
  LogOut,
  ArrowLeft,
  Server,
  Activity,
  Check,
  Globe,
  ExternalLink,
  BarChart3,
} from "lucide-react";

export const dynamic = "force-dynamic";

function formatBytes(bytes: bigint | number): string {
  const num = typeof bytes === "bigint" ? Number(bytes) : bytes;
  if (!num || num === 0) return "0 ميجابايت";
  const k = 1024;
  const sizes = ["بايت", "كيلوبايت", "ميجابايت", "جيجابايت", "تيرابايت"];
  const i = Math.floor(Math.log(num) / Math.log(k));
  return `${(num / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

export default async function AdminDashboardPage() {
  // 1. Strict Server-Side Super Admin Authentication Verification (admin domain only)
  const session = await getSessionUser();
  if (!session || session.role !== "SUPER_ADMIN") {
    redirect("/login");
  }

  // 2. High-Availability Data Fetching (works seamlessly with PostgreSQL or persistent store)
  const [tenantsList, latestCommit, isDbOnline] = await Promise.all([
    getTenantsList(),
    getLatestCommitInfo(),
    isDatabaseReachable(),
  ]);

  const totalTenants = tenantsList.length;
  const activeSubscriptions = tenantsList.filter((t) => t.subscriptionStatus === "ACTIVE").length;
  const stoppedSubscriptions = tenantsList.filter((t) => t.subscriptionStatus === "STOPPED").length;
  const totalStorageUsedBytes = tenantsList.reduce(
    (acc, t) => acc + Number(t.usedStorageBytes || 0),
    0
  );

  return (
    <div className="flex-1 h-full w-full overflow-y-auto bg-[#F4F6FA] text-slate-800 pb-20" dir="rtl">
      {/* Top Navigation Bar - Full Width & Sticky */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-20 shadow-2xs">
        <div className="w-full px-6 lg:px-10 xl:px-12 py-3.5 flex flex-wrap items-center justify-between gap-4">
          {/* Right Side: Identity & System Status Badges */}
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight whitespace-nowrap">
                  لوحة تحكم مدير النظام
                </h1>
                <span className="text-[11px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-full whitespace-nowrap">
                  SUPER_ADMIN
                </span>
                {isDbOnline ? (
                  <span className="text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5 whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>قاعدة بيانات نشطة</span>
                  </span>
                ) : (
                  <span className="text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5 whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    <span>تخزين سحابي مستمر</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                إدارة المشتركين (المعلمين والسناتر)، خادم Hostinger VPS، وصلاحيات المنصة
              </p>
            </div>
          </div>

          {/* Left Side: Primary Action Buttons Toolbar */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Create Tenant Modal Trigger */}
            <CreateTenantModal />

            {/* Global Clients Usage Analytics Link */}
            <Link
              href="/admin/analytics"
              className="inline-flex items-center gap-2 text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 h-10 px-4 rounded-xl transition-all shadow-sm shadow-indigo-600/20 whitespace-nowrap shrink-0"
              title="مركز تحليلات وتتبع سلوك جميع العملاء"
            >
              <BarChart3 className="w-4 h-4 shrink-0" />
              <span>تحليلات وتتبع العملاء</span>
            </Link>

            {/* Auto Update from Repo Button */}
            <AutoUpdateButton initialCommit={latestCommit} />

            {/* Direct Link to Main Application Platform (exambuilderapp.oqabagency.com) */}
            <a
              href={DEFAULT_MAIN_APP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs font-extrabold text-indigo-700 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-200/80 h-10 px-4 rounded-xl transition-all shadow-2xs whitespace-nowrap shrink-0"
              title="الانتقال إلى المنصة الرئيسية: exambuilderapp.oqabagency.com"
            >
              <Globe className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span>المنصة الرئيسية</span>
              <ExternalLink className="w-3 h-3 text-indigo-400 shrink-0" />
            </a>

            {/* Back to Main Dashboard & Exam Builder (local dev "all" mode) */}
            {tenantEnabled() && (
              <>
                <Link
                  href="/"
                  className="inline-flex items-center gap-1.5 text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-700 h-10 px-4 rounded-xl transition-all shadow-2xs whitespace-nowrap shrink-0"
                >
                  <span>معاينة الداشبورد</span>
                  <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
                </Link>
                <Link
                  href="/exam-builder"
                  className="inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-700 hover:text-blue-600 bg-slate-100 hover:bg-slate-200/70 h-10 px-4 rounded-xl transition-all whitespace-nowrap shrink-0"
                >
                  <span>منشئ الاختبارات</span>
                  <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
                </Link>
              </>
            )}

            {/* Logout */}
            <form action={logoutAction} className="shrink-0">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 text-xs font-extrabold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100/70 border border-red-200/60 h-10 px-4 rounded-xl transition-all cursor-pointer whitespace-nowrap"
              >
                <LogOut className="w-3.5 h-3.5 shrink-0" />
                <span>خروج</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Content Container - Full Width */}
      <div className="w-full px-6 lg:px-10 xl:px-12 py-6 space-y-6">
        {/* Section 1: Hostinger VPS Live Status Banner */}
        <section className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl px-6 py-5 border border-slate-800 shadow-md">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            {/* Right: Server Info */}
            <div className="flex items-start sm:items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shrink-0">
                <Server className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-base sm:text-lg font-black tracking-tight text-white whitespace-nowrap">
                    خادم Hostinger VPS السحابي
                  </h2>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>متصل ونشط (Running)</span>
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300 font-mono">
                  <span className="bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg">
                    IP: <strong className="text-white font-bold">{HOSTINGER_VPS_CONFIG.ip}</strong>
                  </span>
                  <span className="bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg">
                    الخادم: <strong className="text-white font-bold">{HOSTINGER_VPS_CONFIG.hostname}</strong>
                  </span>
                  <span className="bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg">
                    النظام: <strong className="text-slate-200">Ubuntu 24.04 LTS</strong>
                  </span>
                  <span className="bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg">
                    المواصفات: <strong className="text-slate-200">8GB RAM | 100GB NVMe</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Left: Metrics & Deploy Action in a Single Clean Row */}
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl px-4 py-2 flex items-center gap-3">
                <div className="text-right">
                  <p className="text-[11px] font-bold text-slate-400 whitespace-nowrap">الدومينات المربوطة</p>
                  <p className="text-lg font-black text-blue-400 font-mono leading-tight">
                    {tenantsList.filter((t) => !!t.domain).length}
                  </p>
                </div>
              </div>
              <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl px-4 py-2 flex items-center gap-3">
                <div className="text-right">
                  <p className="text-[11px] font-bold text-slate-400 whitespace-nowrap">المستأجرين النشطين</p>
                  <p className="text-lg font-black text-emerald-400 font-mono leading-tight">
                    {activeSubscriptions}
                  </p>
                </div>
              </div>
              <VpsDeployButton />
            </div>
          </div>
        </section>

        {/* Section 2: Quick Stats Cards (4 Columns Full Width) */}
        <section>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Tenants */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs flex items-center justify-between gap-4 transition-all hover:shadow-md">
              <div>
                <p className="text-xs font-bold text-slate-400">إجمالي المستأجرين</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                    {totalTenants}
                  </h3>
                  <span className="text-xs font-bold text-slate-500">حساب مسجل</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
                <Users className="w-6 h-6" />
              </div>
            </div>

            {/* Card 2: Active Subscriptions */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs flex items-center justify-between gap-4 transition-all hover:shadow-md">
              <div>
                <p className="text-xs font-bold text-slate-400">الاشتراكات النشطة</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <h3 className="text-2xl font-black text-emerald-600 tracking-tight">
                    {activeSubscriptions}
                  </h3>
                  <span className="text-xs font-bold text-slate-500">نشط حالياً</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>

            {/* Card 3: Stopped Subscriptions */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs flex items-center justify-between gap-4 transition-all hover:shadow-md">
              <div>
                <p className="text-xs font-bold text-slate-400">الحسابات الموقوفة</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <h3 className="text-2xl font-black text-amber-600 tracking-tight">
                    {stoppedSubscriptions}
                  </h3>
                  <span className="text-xs font-bold text-slate-500">معلق / متوقف</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0">
                <Activity className="w-6 h-6" />
              </div>
            </div>

            {/* Card 4: Total System Storage Used */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs flex items-center justify-between gap-4 transition-all hover:shadow-md">
              <div>
                <p className="text-xs font-bold text-slate-400">إجمالي التخزين</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                    {formatUsedStorageShortArabic(totalStorageUsedBytes)}
                  </h3>
                  <span className="text-xs font-bold text-slate-500">مستخدم</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center shrink-0">
                <HardDrive className="w-6 h-6" />
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Interactive Tenant List View with Unified Toolbar & Table */}
        <section>
          <TenantListView initialTenants={tenantsList as any} />
        </section>
      </div>
    </div>
  );
}
