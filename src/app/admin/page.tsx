import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { logoutAction } from "@/app/actions/auth";
import CreateTenantModal from "@/components/admin/CreateTenantModal";
import TenantListView from "@/components/admin/TenantListView";
import AutoUpdateButton from "@/components/admin/AutoUpdateButton";
import VpsDeployButton from "@/components/admin/VpsDeployButton";
import { HOSTINGER_VPS_CONFIG } from "@/lib/vps-service";
import { getTenantsList, getTenantCounts } from "@/lib/tenants-repository";
import { getLatestCommitInfo } from "@/app/actions/auto-update";
import { isDatabaseReachable } from "@/lib/prisma";
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
  // 1. Strict Server-Side Super Admin Authentication Verification
  const session = await getSessionUser();
  if (!session || session.role !== "SUPER_ADMIN") {
    redirect("/denied");
  }

  // 2. High-Availability Data Fetching (works seamlessly with PostgreSQL or persistent store)
  const [tenantsList, counts, latestCommit, isDbOnline] = await Promise.all([
    getTenantsList(),
    getTenantCounts(),
    getLatestCommitInfo(),
    isDatabaseReachable(),
  ]);

  const totalTenants = counts.total;
  const activeSubscriptions = counts.active;
  const stoppedSubscriptions = counts.stopped;
  const totalStorageUsedBytes = counts.usedStorageBytes;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800" dir="rtl">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-20 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-md shadow-blue-500/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black text-slate-900 tracking-tight">
                  لوحة تحكم مدير النظام
                </h1>
                <span className="text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-full">
                  SUPER_ADMIN
                </span>
                {isDbOnline ? (
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>قاعدة بيانات نشطة</span>
                  </span>
                ) : (
                  <span className="text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    <span>تخزين سحابي مستمر</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium">
                إدارة المعلمين، خادم VPS، والاشتراكات
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Auto Update from Repo Button */}
            <AutoUpdateButton initialCommit={latestCommit} />

            {/* Create Tenant Modal Trigger */}
            <CreateTenantModal />

            {/* Back to Exam Builder */}
            <Link
              href="/exam-builder"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-blue-600 bg-slate-100 hover:bg-slate-200/70 px-3.5 py-2.5 rounded-xl transition-all"
            >
              <span>منشئ الاختبارات</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </Link>

            {/* Logout */}
            <form action={logoutAction}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100/70 border border-red-200/60 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>خروج</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Section 1: Hostinger VPS Live Status Banner */}
        <section className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 border border-slate-800 shadow-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shrink-0">
                <Server className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-base font-black tracking-tight text-white">
                    خادم Hostinger VPS السحابي
                  </h2>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>متصل ونشط (Running)</span>
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 mt-1.5 font-mono">
                  <span>IP: <strong className="text-white font-bold">{HOSTINGER_VPS_CONFIG.ip}</strong></span>
                  <span>•</span>
                  <span>الخادم: <strong className="text-white font-bold">{HOSTINGER_VPS_CONFIG.hostname}</strong></span>
                  <span>•</span>
                  <span>النظام: <strong className="text-slate-300">Ubuntu 24.04 LTS</strong></span>
                  <span>•</span>
                  <span>المواصفات: <strong className="text-slate-300">8GB RAM | 100GB NVMe</strong></span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <VpsDeployButton />
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl px-4 py-2.5 text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase">الدومينات المربوطة</p>
                <p className="text-lg font-black text-blue-400 font-mono">
                  {tenantsList.filter((t) => !!t.domain).length}
                </p>
              </div>
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl px-4 py-2.5 text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase">المستأجرين النشطين</p>
                <p className="text-lg font-black text-emerald-400 font-mono">
                  {activeSubscriptions}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Quick Stats Cards */}
        <section>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Card 1: Total Tenants */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center gap-4 transition-all hover:shadow-md">
              <div className="w-13 h-13 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                  إجمالي المستأجرين
                </p>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                    {totalTenants}
                  </h3>
                  <span className="text-xs font-semibold text-slate-500">معلم</span>
                </div>
              </div>
            </div>

            {/* Card 2: Active Subscriptions */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center gap-4 transition-all hover:shadow-md">
              <div className="w-13 h-13 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                  الاشتراكات النشطة
                </p>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <h3 className="text-2xl font-black text-emerald-600 tracking-tight">
                    {activeSubscriptions}
                  </h3>
                  <span className="text-xs font-semibold text-slate-500">نشط حالياً</span>
                </div>
              </div>
            </div>

            {/* Card 3: Stopped Subscriptions */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center gap-4 transition-all hover:shadow-md">
              <div className="w-13 h-13 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                  الحسابات الموقوفة
                </p>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <h3 className="text-2xl font-black text-amber-600 tracking-tight">
                    {stoppedSubscriptions}
                  </h3>
                  <span className="text-xs font-semibold text-slate-500">معلق / متوقف</span>
                </div>
              </div>
            </div>

            {/* Card 4: Total System Storage Used */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center gap-4 transition-all hover:shadow-md">
              <div className="w-13 h-13 rounded-2xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center shrink-0">
                <HardDrive className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                  إجمالي التخزين
                </p>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">
                    {formatBytes(totalStorageUsedBytes)}
                  </h3>
                  <span className="text-[11px] font-semibold text-slate-500">مستخدم</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Interactive Tenant List View with Filters & Modals */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                <span>إدارة المستأجرين والاشتراكات (Tenant & Subscription Management)</span>
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                تعديل وتمديد الاشتراكات، تعليق الحسابات، ضبط الحدود والمساحة، وإعداد النطاقات على خادم VPS Hostinger
              </p>
            </div>
          </div>

          <TenantListView initialTenants={tenantsList as any} />
        </section>
      </main>
    </div>
  );
}
